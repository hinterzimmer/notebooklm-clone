import test from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { SourcesService } from './sources.service.js';

test('SourcesService upload and deduplication tests', async (t) => {
  await t.test('short-circuits ingestion when file matches latest version SHA-256 hash', async () => {
    // given
    const fileContent = 'Corporate Quarterly Report Q3 2026';
    const fileBuffer = Buffer.from(fileContent);
    const expectedHash = createHash('sha256').update(fileBuffer).digest('hex');
    const mockFile = {
      originalname: 'report.txt',
      mimetype: 'text/plain',
      buffer: fileBuffer,
    } as Express.Multer.File;

    let s3Called = false;
    let ingestionCalled = false;

    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes('FROM sources s')) {
          return {
            rows: [
              {
                id: 'existing-source-id',
                latest_version_id: 'existing-version-id',
                sha256_hash: expectedHash,
                version_number: 1,
              },
            ],
          };
        }
        return { rows: [] };
      },
    } as any;
    const mockUserContext = {
      getUserId: () => 'user-123',
    } as any;
    const mockS3Service = {
      uploadBuffer: async () => {
        s3Called = true;
      },
    } as any;
    const mockIngestionService = {
      startIngestion: () => {
        ingestionCalled = true;
      },
    } as any;

    const sourcesService = new SourcesService(
      mockDbService,
      mockUserContext,
      mockS3Service,
      mockIngestionService,
    );

    // when
    const result = await sourcesService.uploadSource('notebook-1', mockFile);

    // then
    assert.deepStrictEqual(result, {
      sourceId: 'existing-source-id',
      versionId: 'existing-version-id',
      versionNumber: 1,
      status: 'READY',
      isDeduplicated: true,
    });
    assert.strictEqual(s3Called, false, 'S3 upload should not be invoked when deduplicated');
    assert.strictEqual(ingestionCalled, false, 'Ingestion should not start when deduplicated');
  });

  await t.test('creates new version and triggers ingestion when file content changed', async () => {
    // given
    const oldHash = 'different_previous_hash_123';
    const newFileContent = 'Corporate Quarterly Report Q3 2026 - Revised';
    const fileBuffer = Buffer.from(newFileContent);
    const expectedNewHash = createHash('sha256').update(fileBuffer).digest('hex');
    const mockFile = {
      originalname: 'report.txt',
      mimetype: 'text/plain',
      buffer: fileBuffer,
    } as Express.Multer.File;

    const s3Calls: any[] = [];
    const ingestionJobs: any[] = [];
    const dbQueries: any[] = [];

    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        dbQueries.push({ sql, params });
        if (sql.includes('FROM sources s')) {
          return {
            rows: [
              {
                id: 'existing-source-id',
                latest_version_id: 'existing-version-id',
                sha256_hash: oldHash,
                version_number: 1,
              },
            ],
          };
        }
        return { rows: [] };
      },
    } as any;
    const mockUserContext = {
      getUserId: () => 'user-123',
    } as any;
    const mockS3Service = {
      uploadBuffer: async (key: string, buffer: Buffer, mime: string) => {
        s3Calls.push({ key, buffer, mime });
      },
    } as any;
    const mockIngestionService = {
      startIngestion: (job: any) => {
        ingestionJobs.push(job);
      },
    } as any;

    const sourcesService = new SourcesService(
      mockDbService,
      mockUserContext,
      mockS3Service,
      mockIngestionService,
    );

    // when
    const result = await sourcesService.uploadSource('notebook-1', mockFile);

    // then
    assert.strictEqual(result.sourceId, 'existing-source-id');
    assert.strictEqual(result.versionNumber, 2);
    assert.strictEqual(result.status, 'UPLOADED');
    assert.strictEqual(result.isDeduplicated, false);

    assert.strictEqual(s3Calls.length, 1);
    assert.strictEqual(
      s3Calls[0].key,
      'notebooks/notebook-1/sources/existing-source-id/v2/raw/report.txt',
    );
    assert.strictEqual(ingestionJobs.length, 1);
    assert.strictEqual(ingestionJobs[0].notebook_id, 'notebook-1');
    assert.strictEqual(ingestionJobs[0].source_id, 'existing-source-id');
    assert.strictEqual(ingestionJobs[0].version_id, result.versionId);
    assert.strictEqual(ingestionJobs[0].owner_id, 'user-123');

    const versionInsert = dbQueries.find((q) => q.sql.includes('INSERT INTO source_versions'));
    assert.ok(versionInsert);
    assert.strictEqual(versionInsert.params[1], 'existing-source-id');
    assert.strictEqual(versionInsert.params[3], 2);
    assert.strictEqual(versionInsert.params[5], expectedNewHash);
  });

  await t.test('creates brand-new source and version 1 when source does not exist', async () => {
    // given
    const mockFile = {
      originalname: 'new-document.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('PDF content'),
    } as Express.Multer.File;

    const dbQueries: any[] = [];
    const s3Calls: any[] = [];
    const ingestionJobs: any[] = [];

    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        dbQueries.push({ sql, params });
        return { rows: [] };
      },
    } as any;
    const mockUserContext = {
      getUserId: () => undefined, // test fallback userId
    } as any;
    const mockS3Service = {
      uploadBuffer: async (key: string, buffer: Buffer, mime: string) => {
        s3Calls.push({ key, buffer, mime });
      },
    } as any;
    const mockIngestionService = {
      startIngestion: (job: any) => {
        ingestionJobs.push(job);
      },
    } as any;

    const sourcesService = new SourcesService(
      mockDbService,
      mockUserContext,
      mockS3Service,
      mockIngestionService,
    );

    // when
    const result = await sourcesService.uploadSource('notebook-2', mockFile);

    // then
    assert.strictEqual(result.versionNumber, 1);
    assert.strictEqual(result.status, 'UPLOADED');
    assert.strictEqual(result.isDeduplicated, false);

    const sourceInsert = dbQueries.find((q) => q.sql.includes('INSERT INTO sources'));
    assert.ok(sourceInsert);
    assert.strictEqual(sourceInsert.params[1], 'notebook-2');
    assert.strictEqual(sourceInsert.params[2], '00000000-0000-7000-8000-000000000001'); // default user fallback
    assert.strictEqual(sourceInsert.params[3], 'new-document.pdf');
    assert.strictEqual(sourceInsert.params[4], 'application/pdf');

    assert.strictEqual(s3Calls.length, 1);
    assert.ok(s3Calls[0].key.includes('/v1/raw/new-document.pdf'));
    assert.strictEqual(ingestionJobs.length, 1);
  });
});
