import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.provider.js';
import { TelemetryService } from '../../database/telemetry.service.js';
import { S3Service } from '../../aws/s3.service.js';
import { BedrockService } from '../../aws/bedrock.service.js';
import { AstSplitterService } from './splitters/ast.splitter.js';
import { HybridRrfStrategy } from '../knowledge/hybrid-rag/hybrid-rrf.strategy.js';
import { IngestionStatus } from '@notebooklm/shared';

export interface IngestionJob {
  notebook_id: string;
  source_id: string;
  version_id: string;
  owner_id: string;
  s3_raw_key: string;
  mime_type: string;
  filename: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly telemetryService: TelemetryService,
    private readonly s3Service: S3Service,
    private readonly bedrockService: BedrockService,
    private readonly astSplitterService: AstSplitterService,
    private readonly hybridRrfStrategy: HybridRrfStrategy,
  ) {}

  /**
   * Starts ingestion asynchronously in the background.
   */
  startIngestion(job: IngestionJob): void {
    this.processJob(job).catch(async (err) => {
      this.logger.error(`Ingestion failed for version ${job.version_id}: ${err.message}`, err.stack);
      await this.recordStatus(
        job.notebook_id,
        job.source_id,
        job.version_id,
        'FAILED',
        100,
        err.message || 'Ingestion failed',
      );
    });
  }

  async processJob(job: IngestionJob): Promise<void> {
    this.logger.log(`Starting ingestion for source ${job.source_id}, version ${job.version_id}`);

    // 1. Parsing
    await this.recordStatus(job.notebook_id, job.source_id, job.version_id, 'BDA_PARSING', 25);
    const rawBuffer = await this.s3Service.getObjectBuffer(job.s3_raw_key);
    let markdown = '';

    if (
      job.mime_type.includes('text') ||
      job.mime_type.includes('markdown') ||
      job.filename.endsWith('.md') ||
      job.filename.endsWith('.txt')
    ) {
      markdown = rawBuffer.toString('utf-8');
    } else {
      let docFormat: 'pdf' | 'png' | 'jpeg' | 'txt' | 'md' = 'txt';
      if (job.mime_type.includes('pdf') || job.filename.endsWith('.pdf')) docFormat = 'pdf';
      else if (job.mime_type.includes('png') || job.filename.endsWith('.png')) docFormat = 'png';
      else if (job.mime_type.includes('jpeg') || job.filename.endsWith('.jpg')) docFormat = 'jpeg';

      const systemPrompt =
        'You are a high-fidelity document converter. Convert the input document into standard, clean Markdown with preserved headings (#, ##, ###), lists, and formatted tables.';
      const userPrompt = 'Please convert this document into clean, fully structured Markdown.';

      markdown = await this.bedrockService.converseWithDocument(
        rawBuffer,
        docFormat,
        systemPrompt,
        userPrompt,
      );
    }

    // Unicode NFKC normalization
    markdown = (markdown || rawBuffer.toString('utf-8')).normalize('NFKC');

    // 2. Splitting
    await this.recordStatus(job.notebook_id, job.source_id, job.version_id, 'SPLITTING', 50);
    const chunks = this.astSplitterService.splitMarkdown(markdown, job.source_id, job.version_id);

    // 3. Indexing
    await this.recordStatus(job.notebook_id, job.source_id, job.version_id, 'INDEXING', 75);
    await this.hybridRrfStrategy.indexDocument({
      notebookId: job.notebook_id,
      sourceId: job.source_id,
      versionId: job.version_id,
      ownerId: job.owner_id,
      rawMarkdown: markdown,
      chunks,
    });

    // 4. Mark READY and update latest_version_id
    await this.databaseService.withWriteTransaction(async (client) => {
      await client.query(
        `UPDATE source_versions SET status = 'READY', processing_progress = 100, error_detail = NULL WHERE id = $1`,
        [job.version_id],
      );
      await client.query(
        `UPDATE sources SET latest_version_id = $1 WHERE id = $2`,
        [job.version_id, job.source_id],
      );
    });

    await this.telemetryService.emitIngestionEvent({
      notebook_id: job.notebook_id,
      source_id: job.source_id,
      version_id: job.version_id,
      status: 'READY',
      processing_progress: 100,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Ingestion completed for source ${job.source_id}, version ${job.version_id}`);
  }

  private async recordStatus(
    notebookId: string,
    sourceId: string,
    versionId: string,
    status: IngestionStatus,
    progress: number,
    errorDetail?: string,
  ): Promise<void> {
    await this.databaseService.withWriteTransaction(async (client) => {
      await client.query(
        `UPDATE source_versions
         SET status = $1, processing_progress = $2, error_detail = $3
         WHERE id = $4`,
        [status, progress, errorDetail || null, versionId],
      );
    });

    await this.telemetryService.emitIngestionEvent({
      notebook_id: notebookId,
      source_id: sourceId,
      version_id: versionId,
      status,
      processing_progress: progress,
      error_detail: errorDetail,
      timestamp: new Date().toISOString(),
    });
  }
}
