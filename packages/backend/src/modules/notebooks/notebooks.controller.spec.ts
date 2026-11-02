import test from 'node:test';
import assert from 'node:assert';
import { NotebooksController } from './notebooks.controller.js';
import { Subject, firstValueFrom } from 'rxjs';

test('NotebooksController unit tests', async (t) => {
  await t.test('create delegates to notebooksService.createNotebook', async () => {
    // given
    const createdDtos: any[] = [];
    const mockService = {
      createNotebook: async (dto: any) => {
        createdDtos.push(dto);
        return { id: 'nb-ctrl-1', ...dto };
      },
    } as any;
    const controller = new NotebooksController(mockService, {} as any);
    const dto = { title: 'Controller Notebook', strategy: 'hybrid_rag' as const };

    // when
    const result = await controller.create(dto);

    // then
    assert.strictEqual(result.id, 'nb-ctrl-1');
    assert.strictEqual(createdDtos.length, 1);
    assert.deepStrictEqual(createdDtos[0], dto);
  });

  await t.test('list delegates to notebooksService.listNotebooks', async () => {
    // given
    const mockService = {
      listNotebooks: async () => [{ id: 'nb-1' }, { id: 'nb-2' }],
    } as any;
    const controller = new NotebooksController(mockService, {} as any);

    // when
    const list = await controller.list();

    // then
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].id, 'nb-1');
  });

  await t.test('get delegates to notebooksService.getNotebook', async () => {
    // given
    const requestedIds: string[] = [];
    const mockService = {
      getNotebook: async (id: string) => {
        requestedIds.push(id);
        return { id, title: 'Found' };
      },
    } as any;
    const controller = new NotebooksController(mockService, {} as any);

    // when
    const result = await controller.get('nb-get-1');

    // then
    assert.strictEqual(result.id, 'nb-get-1');
    assert.deepStrictEqual(requestedIds, ['nb-get-1']);
  });

  await t.test('update delegates to notebooksService.updateNotebook', async () => {
    // given
    const updateCalls: any[] = [];
    const mockService = {
      updateNotebook: async (id: string, updates: any) => {
        updateCalls.push({ id, updates });
        return { id, ...updates };
      },
    } as any;
    const controller = new NotebooksController(mockService, {} as any);

    // when
    const result = await controller.update('nb-up-1', { title: 'Updated' });

    // then
    assert.strictEqual(result.title, 'Updated');
    assert.deepStrictEqual(updateCalls[0], { id: 'nb-up-1', updates: { title: 'Updated' } });
  });

  await t.test('delete delegates to notebooksService.deleteNotebook', async () => {
    // given
    const deletedIds: string[] = [];
    const mockService = {
      deleteNotebook: async (id: string) => {
        deletedIds.push(id);
        return { success: true };
      },
    } as any;
    const controller = new NotebooksController(mockService, {} as any);

    // when
    const result = await controller.delete('nb-del-1');

    // then
    assert.deepStrictEqual(result, { success: true });
    assert.deepStrictEqual(deletedIds, ['nb-del-1']);
  });

  await t.test('streamEvents maps telemetry observable event to SSE data string', async () => {
    // given
    const subject = new Subject<any>();
    const mockTelemetry = {
      getNotebookEvents: (id: string) => subject.asObservable(),
    } as any;
    const controller = new NotebooksController({} as any, mockTelemetry);

    // when
    const eventPromise = firstValueFrom(controller.streamEvents('nb-sse-1'));
    subject.next({
      notebook_id: 'nb-sse-1',
      status: 'READY',
      processing_progress: 100,
    });
    const sseEvent = await eventPromise;

    // then
    assert.ok(sseEvent.data);
    const parsed = JSON.parse(sseEvent.data);
    assert.strictEqual(parsed.status, 'READY');
    assert.strictEqual(parsed.notebook_id, 'nb-sse-1');
  });
});
