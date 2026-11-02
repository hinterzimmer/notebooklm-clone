import test from 'node:test';
import assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { NotebooksService } from './notebooks.service.js';

test('NotebooksService unit tests', async (t) => {
  await t.test('createNotebook creates notebook with default hybrid_rag strategy', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
        return {
          rows: [
            {
              id: params[0],
              owner_id: params[1],
              title: params[2],
              strategy: params[3],
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      },
    } as any;
    const mockUserContext = {
      getUserId: () => 'user-abc',
    } as any;
    const service = new NotebooksService(mockDbService, mockUserContext);

    // when
    const result = await service.createNotebook({ title: 'My Research Notebook' });

    // then
    assert.strictEqual(result.title, 'My Research Notebook');
    assert.strictEqual(result.strategy, 'hybrid_rag');
    assert.strictEqual(result.owner_id, 'user-abc');
    assert.strictEqual(queryCalls.length, 1);
    assert.strictEqual(queryCalls[0].useWritePool, true);
    assert.strictEqual(queryCalls[0].params[2], 'My Research Notebook');
    assert.strictEqual(queryCalls[0].params[3], 'hybrid_rag');
  });

  await t.test('createNotebook creates notebook with custom strategy and fallback userId', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
        return {
          rows: [
            {
              id: params[0],
              owner_id: params[1],
              title: params[2],
              strategy: params[3],
            },
          ],
        };
      },
    } as any;
    const mockUserContext = {
      getUserId: () => undefined,
    } as any;
    const service = new NotebooksService(mockDbService, mockUserContext);

    // when
    const result = await service.createNotebook({ title: 'KG Notebook', strategy: 'open_kg' });

    // then
    assert.strictEqual(result.strategy, 'open_kg');
    assert.strictEqual(result.owner_id, '00000000-0000-7000-8000-000000000001');
    assert.strictEqual(queryCalls[0].params[1], '00000000-0000-7000-8000-000000000001');
  });

  await t.test('listNotebooks returns notebooks ordered by updated_at', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
        return { rows: [{ id: 'nb-1', title: 'NB 1' }, { id: 'nb-2', title: 'NB 2' }] };
      },
    } as any;
    const service = new NotebooksService(mockDbService, {} as any);

    // when
    const list = await service.listNotebooks();

    // then
    assert.strictEqual(list.length, 2);
    assert.strictEqual(queryCalls.length, 1);
    assert.strictEqual(queryCalls[0].useWritePool, false);
    assert.ok(queryCalls[0].sql.includes('ORDER BY updated_at DESC'));
  });

  await t.test('getNotebook returns notebook row if found', async () => {
    // given
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        return { rows: [{ id: 'nb-123', title: 'Found NB' }] };
      },
    } as any;
    const service = new NotebooksService(mockDbService, {} as any);

    // when
    const nb = await service.getNotebook('nb-123');

    // then
    assert.deepStrictEqual(nb, { id: 'nb-123', title: 'Found NB' });
  });

  await t.test('getNotebook throws NotFoundException when notebook does not exist', async () => {
    // given
    const mockDbService = {
      query: async () => ({ rows: [] }),
    } as any;
    const service = new NotebooksService(mockDbService, {} as any);

    // when
    let error: any;
    try {
      await service.getNotebook('missing-id');
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof NotFoundException);
    assert.strictEqual(error.message, 'Notebook missing-id not found');
  });

  await t.test('updateNotebook updates title and strategy dynamically', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        queryCalls.push({ sql, params });
        return { rows: [{ id: 'nb-1', title: 'New Title', strategy: 'open_kg' }] };
      },
    } as any;
    const service = new NotebooksService(mockDbService, {} as any);

    // when
    const updated = await service.updateNotebook('nb-1', {
      title: 'New Title',
      strategy: 'open_kg',
    });

    // then
    assert.strictEqual(updated.title, 'New Title');
    assert.strictEqual(queryCalls.length, 1);
    assert.ok(queryCalls[0].sql.includes('title = $2'));
    assert.ok(queryCalls[0].sql.includes('strategy = $3'));
    assert.deepStrictEqual(queryCalls[0].params, ['nb-1', 'New Title', 'open_kg']);
  });

  await t.test('updateNotebook throws NotFoundException when target does not exist', async () => {
    // given
    const mockDbService = {
      query: async () => ({ rows: [] }),
    } as any;
    const service = new NotebooksService(mockDbService, {} as any);

    // when
    let error: any;
    try {
      await service.updateNotebook('missing-nb', { title: 'New Title' });
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof NotFoundException);
    assert.strictEqual(error.message, 'Notebook missing-nb not found');
  });

  await t.test('deleteNotebook executes DELETE query on write pool', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        queryCalls.push({ sql, params, useWritePool });
        return { rows: [] };
      },
    } as any;
    const service = new NotebooksService(mockDbService, {} as any);

    // when
    const result = await service.deleteNotebook('nb-delete-1');

    // then
    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(queryCalls.length, 1);
    assert.strictEqual(queryCalls[0].useWritePool, true);
    assert.deepStrictEqual(queryCalls[0].params, ['nb-delete-1']);
  });
});
