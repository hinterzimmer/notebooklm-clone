import test from 'node:test';
import assert from 'node:assert';
import { IngestionService, IngestionJob } from './ingestion.service.js';

test('IngestionService unit tests', async (t) => {
  const createMockServices = () => {
    const dbQueries: any[] = [];
    const telemetryEvents: any[] = [];
    const s3Reads: string[] = [];
    const bedrockConverseCalls: any[] = [];
    const splitCalls: any[] = [];
    const indexCalls: any[] = [];

    const mockDbService = {
      withWriteTransaction: async (cb: any) => {
        const client = {
          query: async (sql: string, params: any[]) => {
            dbQueries.push({ sql, params });
          },
        };
        return await cb(client);
      },
    } as any;

    const mockTelemetryService = {
      emitIngestionEvent: async (event: any) => {
        telemetryEvents.push(event);
      },
    } as any;

    const mockS3Service = {
      getObjectBuffer: async (key: string) => {
        s3Reads.push(key);
        return Buffer.from('# Test Document\nLine 1\nLine 2');
      },
    } as any;

    const mockBedrockService = {
      converseWithDocument: async (bytes: Buffer, format: string, sys: string, user: string) => {
        bedrockConverseCalls.push({ bytes, format, sys, user });
        return '# Converted Markdown from Bedrock';
      },
    } as any;

    const mockAstSplitter = {
      splitMarkdown: (md: string, srcId: string, verId: string) => {
        splitCalls.push({ md, srcId, verId });
        return [
          {
            chunkIndex: 0,
            content: md,
            citationAnchor: { anchor_id: 'a1' },
            isMultimodal: false,
          },
        ];
      },
    } as any;

    const mockStrategy = {
      indexDocument: async (ctx: any) => {
        indexCalls.push(ctx);
      },
    } as any;

    const service = new IngestionService(
      mockDbService,
      mockTelemetryService,
      mockS3Service,
      mockBedrockService,
      mockAstSplitter,
      mockStrategy,
    );

    return {
      service,
      dbQueries,
      telemetryEvents,
      s3Reads,
      bedrockConverseCalls,
      splitCalls,
      indexCalls,
      mockS3Service,
    };
  };

  await t.test('processJob processes text/markdown file without calling Bedrock converse', async () => {
    // given
    const ctx = createMockServices();
    const job: IngestionJob = {
      notebook_id: 'nb-1',
      source_id: 'src-1',
      version_id: 'ver-1',
      owner_id: 'user-1',
      s3_raw_key: 'notebooks/nb-1/sources/src-1/v1/raw/doc.md',
      mime_type: 'text/markdown',
      filename: 'doc.md',
    };

    // when
    await ctx.service.processJob(job);

    // then
    assert.strictEqual(ctx.s3Reads.length, 1);
    assert.strictEqual(ctx.s3Reads[0], job.s3_raw_key);
    assert.strictEqual(ctx.bedrockConverseCalls.length, 0, 'Text files should not call Bedrock converse');
    assert.strictEqual(ctx.splitCalls.length, 1);
    assert.strictEqual(ctx.indexCalls.length, 1);
    assert.strictEqual(ctx.indexCalls[0].versionId, 'ver-1');

    // Telemetry events sequence: BDA_PARSING(25) -> SPLITTING(50) -> INDEXING(75) -> READY(100)
    assert.strictEqual(ctx.telemetryEvents.length, 4);
    assert.strictEqual(ctx.telemetryEvents[0].status, 'BDA_PARSING');
    assert.strictEqual(ctx.telemetryEvents[0].processing_progress, 25);
    assert.strictEqual(ctx.telemetryEvents[1].status, 'SPLITTING');
    assert.strictEqual(ctx.telemetryEvents[1].processing_progress, 50);
    assert.strictEqual(ctx.telemetryEvents[2].status, 'INDEXING');
    assert.strictEqual(ctx.telemetryEvents[2].processing_progress, 75);
    assert.strictEqual(ctx.telemetryEvents[3].status, 'READY');
    assert.strictEqual(ctx.telemetryEvents[3].processing_progress, 100);

    // DB updates: 3 status updates + 1 completion transaction (update versions and sources)
    const updateSources = ctx.dbQueries.find((q) => q.sql.includes('UPDATE sources SET latest_version_id'));
    assert.ok(updateSources);
    assert.strictEqual(updateSources.params[0], 'ver-1');
    assert.strictEqual(updateSources.params[1], 'src-1');
  });

  await t.test('processJob invokes Bedrock converse for PDF and image files', async () => {
    // given
    const ctx = createMockServices();
    const job: IngestionJob = {
      notebook_id: 'nb-2',
      source_id: 'src-2',
      version_id: 'ver-2',
      owner_id: 'user-1',
      s3_raw_key: 'notebooks/nb-2/sources/src-2/v1/raw/annual-report.pdf',
      mime_type: 'application/pdf',
      filename: 'annual-report.pdf',
    };

    // when
    await ctx.service.processJob(job);

    // then
    assert.strictEqual(ctx.bedrockConverseCalls.length, 1);
    assert.strictEqual(ctx.bedrockConverseCalls[0].format, 'pdf');
    assert.strictEqual(ctx.splitCalls[0].md, '# Converted Markdown from Bedrock');
    assert.strictEqual(ctx.telemetryEvents[3].status, 'READY');
  });

  await t.test('startIngestion catches errors and records FAILED status', async () => {
    // given
    const ctx = createMockServices();
    ctx.mockS3Service.getObjectBuffer = async () => {
      throw new Error('S3 access denied');
    };
    const job: IngestionJob = {
      notebook_id: 'nb-err',
      source_id: 'src-err',
      version_id: 'ver-err',
      owner_id: 'user-1',
      s3_raw_key: 'notebooks/err/key',
      mime_type: 'text/plain',
      filename: 'error.txt',
    };

    // when
    ctx.service.startIngestion(job);

    // Wait for the async background job catch handler to execute
    await new Promise((resolve) => setTimeout(resolve, 30));

    // then
    const failedEvent = ctx.telemetryEvents.find((e) => e.status === 'FAILED');
    assert.ok(failedEvent, 'Should have emitted FAILED telemetry event');
    assert.strictEqual(failedEvent.processing_progress, 100);
    assert.strictEqual(failedEvent.error_detail, 'S3 access denied');
  });
});
