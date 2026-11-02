import test from 'node:test';
import assert from 'node:assert';
import { SourcesService } from './sources.service.js';

test('SourcesService listing unit tests', async (t) => {
  await t.test('listSources queries sources with latest version info', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
        return {
          rows: [
            {
              id: 'src-1',
              notebook_id: 'nb-1',
              filename: 'doc1.pdf',
              latest_version_id: 'ver-1',
              version_number: 1,
              status: 'READY',
            },
          ],
        };
      },
    } as any;
    const service = new SourcesService(mockDbService, {} as any, {} as any, {} as any);

    // when
    const sources = await service.listSources('nb-1');

    // then
    assert.strictEqual(sources.length, 1);
    assert.strictEqual(sources[0].id, 'src-1');
    assert.strictEqual(sources[0].filename, 'doc1.pdf');
    assert.strictEqual(queryCalls.length, 1);
    assert.strictEqual(queryCalls[0].useWritePool, false);
    assert.deepStrictEqual(queryCalls[0].params, ['nb-1']);
    assert.ok(queryCalls[0].sql.includes('LEFT JOIN source_versions'));
  });

  await t.test('listVersions queries versions for a specific source ordered by version_number DESC', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
        return {
          rows: [
            { id: 'ver-2', version_number: 2, status: 'READY' },
            { id: 'ver-1', version_number: 1, status: 'READY' },
          ],
        };
      },
    } as any;
    const service = new SourcesService(mockDbService, {} as any, {} as any, {} as any);

    // when
    const versions = await service.listVersions('src-100');

    // then
    assert.strictEqual(versions.length, 2);
    assert.strictEqual(versions[0].version_number, 2);
    assert.strictEqual(versions[1].version_number, 1);
    assert.strictEqual(queryCalls.length, 1);
    assert.strictEqual(queryCalls[0].useWritePool, false);
    assert.deepStrictEqual(queryCalls[0].params, ['src-100']);
  });
});
