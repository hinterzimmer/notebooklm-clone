import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { DatabaseService } from '../../database/database.provider.js';
import { UserContextService } from '../../database/user-context.service.js';
import { S3Service } from '../../aws/s3.service.js';
import { IngestionService } from '../ingestion/ingestion.service.js';

export interface UploadSourceResult {
  sourceId: string;
  versionId: string;
  versionNumber: number;
  status: string;
  isDeduplicated: boolean;
}

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userContextService: UserContextService,
    private readonly s3Service: S3Service,
    private readonly ingestionService: IngestionService,
  ) {}

  /**
   * Handles source file upload with SHA-256 deduplication and deterministic S3 versioning.
   */
  async uploadSource(
    notebookId: string,
    file: Express.Multer.File,
  ): Promise<UploadSourceResult> {
    const ownerId =
      this.userContextService.getUserId() || '00000000-0000-7000-8000-000000000001';

    const sha256Hash = createHash('sha256').update(file.buffer).digest('hex');

    // 1. Check if source already exists in this notebook with the same filename
    const existingSourceRes = await this.databaseService.query(
      `SELECT s.id, s.latest_version_id, v.sha256_hash, v.version_number
       FROM sources s
       LEFT JOIN source_versions v ON v.id = s.latest_version_id
       WHERE s.notebook_id = $1 AND s.filename = $2 AND s.owner_id = $3`,
      [notebookId, file.originalname, ownerId],
      true, // use write pool for read-your-own-writes
    );

    let sourceId: string;
    let nextVersionNumber = 1;

    if (existingSourceRes.rows.length > 0) {
      const existing = existingSourceRes.rows[0];
      sourceId = existing.id;

      // Deduplication check: if hash matches current latest version, short-circuit
      if (existing.sha256_hash === sha256Hash) {
        this.logger.log(
          `File ${file.originalname} matches sha256 hash ${sha256Hash} of latest version. Short-circuiting ingestion.`,
        );
        return {
          sourceId,
          versionId: existing.latest_version_id,
          versionNumber: existing.version_number,
          status: 'READY',
          isDeduplicated: true,
        };
      }

      nextVersionNumber = (existing.version_number || 0) + 1;
    } else {
      sourceId = uuidv7();
      await this.databaseService.query(
        `INSERT INTO sources (id, notebook_id, owner_id, filename, mime_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [sourceId, notebookId, ownerId, file.originalname, file.mimetype],
        true,
      );
    }

    // 2. Upload file to S3 under deterministic key
    const versionId = uuidv7();
    const s3RawKey = `notebooks/${notebookId}/sources/${sourceId}/v${nextVersionNumber}/raw/${file.originalname}`;
    await this.s3Service.uploadBuffer(s3RawKey, file.buffer, file.mimetype);

    // 3. Create new source_versions entry
    await this.databaseService.query(
      `INSERT INTO source_versions (
        id, source_id, owner_id, version_number, s3_raw_key, sha256_hash, status, processing_progress
      ) VALUES ($1, $2, $3, $4, $5, $6, 'UPLOADED', 0)`,
      [versionId, sourceId, ownerId, nextVersionNumber, s3RawKey, sha256Hash],
      true,
    );

    // 4. Start Ingestion directly in-process
    this.ingestionService.startIngestion({
      notebook_id: notebookId,
      source_id: sourceId,
      version_id: versionId,
      owner_id: ownerId,
      s3_raw_key: s3RawKey,
      mime_type: file.mimetype,
      filename: file.originalname,
    });

    return {
      sourceId,
      versionId,
      versionNumber: nextVersionNumber,
      status: 'UPLOADED',
      isDeduplicated: false,
    };
  }

  async listSources(notebookId: string): Promise<any[]> {
    const res = await this.databaseService.query(
      `SELECT s.id, s.notebook_id, s.filename, s.mime_type, s.created_at,
              v.id AS latest_version_id, v.version_number, v.status, v.processing_progress, v.error_detail
       FROM sources s
       LEFT JOIN source_versions v ON v.id = s.latest_version_id
       WHERE s.notebook_id = $1
       ORDER BY s.created_at DESC`,
      [notebookId],
      false,
    );
    return res.rows;
  }

  async listVersions(sourceId: string): Promise<any[]> {
    const res = await this.databaseService.query(
      `SELECT id, source_id, version_number, s3_raw_key, sha256_hash, status, processing_progress, error_detail, created_at
       FROM source_versions
       WHERE source_id = $1
       ORDER BY version_number DESC`,
      [sourceId],
      false,
    );
    return res.rows;
  }
}
