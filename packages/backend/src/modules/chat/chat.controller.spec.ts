import test from 'node:test';
import assert from 'node:assert';
import { ChatController } from './chat.controller.js';
import { firstValueFrom, toArray } from 'rxjs';

test('ChatController unit tests', async (t) => {
  await t.test('createThread delegates to chatService.createThread', async () => {
    // given
    const mockService = {
      createThread: async (nbId: string, title?: string) => ({ id: 'th-1', notebook_id: nbId, title }),
    } as any;
    const controller = new ChatController(mockService);

    // when
    const result = await controller.createThread('nb-ctrl', 'My Conversation');

    // then
    assert.strictEqual(result.id, 'th-1');
    assert.strictEqual(result.notebook_id, 'nb-ctrl');
    assert.strictEqual(result.title, 'My Conversation');
  });

  await t.test('listThreads delegates to chatService.listThreads', async () => {
    // given
    const mockService = {
      listThreads: async (id: string) => [{ id: 'th-1', notebook_id: id }],
    } as any;
    const controller = new ChatController(mockService);

    // when
    const list = await controller.listThreads('nb-1');

    // then
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'th-1');
  });

  await t.test('getThread delegates to chatService.getThread', async () => {
    // given
    const mockService = {
      getThread: async (id: string) => ({ id, title: 'Single Thread' }),
    } as any;
    const controller = new ChatController(mockService);

    // when
    const thread = await controller.getThread('th-single');

    // then
    assert.strictEqual(thread.id, 'th-single');
  });

  await t.test('updateThread delegates to chatService.updateThread', async () => {
    // given
    const mockService = {
      updateThread: async (id: string, body: any) => ({ id, ...body }),
    } as any;
    const controller = new ChatController(mockService);

    // when
    const updated = await controller.updateThread('th-up', { title: 'New Thread Name' });

    // then
    assert.strictEqual(updated.title, 'New Thread Name');
  });

  await t.test('deleteThread delegates to chatService.deleteThread', async () => {
    // given
    const mockService = {
      deleteThread: async (id: string) => ({ success: true, id }),
    } as any;
    const controller = new ChatController(mockService);

    // when
    const deleted = await controller.deleteThread('th-del');

    // then
    assert.deepStrictEqual(deleted, { success: true, id: 'th-del' });
  });

  await t.test('getMessages delegates to chatService.getMessages with converted numeric limit', async () => {
    // given
    const messageCalls: any[] = [];
    const mockService = {
      getMessages: async (id: string, cursor?: string, limit?: number) => {
        messageCalls.push({ id, cursor, limit });
        return [{ id: 'm1' }];
      },
    } as any;
    const controller = new ChatController(mockService);

    // when
    const messages = await controller.getMessages('th-1', 'c-1', 25);

    // then
    assert.strictEqual(messages.length, 1);
    assert.deepStrictEqual(messageCalls[0], { id: 'th-1', cursor: 'c-1', limit: 25 });
  });

  await t.test('postMessage runs executeChatTurnStream and returns latest message', async () => {
    // given
    let streamExecuted = false;
    const mockService = {
      executeChatTurnStream: async () => {
        streamExecuted = true;
      },
      getMessages: async () => [{ id: 'm-user' }, { id: 'm-assistant', content: 'Here is answer' }],
    } as any;
    const controller = new ChatController(mockService);

    // when
    const lastMsg = await controller.postMessage('th-post', 'User query text');

    // then
    assert.strictEqual(streamExecuted, true);
    assert.strictEqual(lastMsg.id, 'm-assistant');
    assert.strictEqual(lastMsg.content, 'Here is answer');
  });

  await t.test('streamTurn emits SSE chunks and completes with done: true', async () => {
    // given
    const mockService = {
      executeChatTurnStream: async (id: string, msg: string, onDelta: any) => {
        await new Promise((r) => setImmediate(r));
        onDelta({ delta: 'Chunk 1' });
        onDelta({ delta: 'Chunk 2' });
      },
    } as any;
    const controller = new ChatController(mockService);

    // when
    const observable = controller.streamTurn('th-stream', 'Hi');
    const events = await firstValueFrom(observable.pipe(toArray()));

    // then
    assert.strictEqual(events.length, 3);
    assert.deepStrictEqual(JSON.parse(events[0].data), { delta: 'Chunk 1' });
    assert.deepStrictEqual(JSON.parse(events[1].data), { delta: 'Chunk 2' });
    assert.deepStrictEqual(JSON.parse(events[2].data), { done: true });
  });

  await t.test('streamTurn catches stream error and emits error event', async () => {
    // given
    const mockService = {
      executeChatTurnStream: async () => {
        await new Promise((r) => setImmediate(r));
        throw new Error('LLM connection error');
      },
    } as any;
    const controller = new ChatController(mockService);

    // when
    const observable = controller.streamTurn('th-err', 'Hi');
    const events = await firstValueFrom(observable.pipe(toArray()));

    // then
    assert.strictEqual(events.length, 1);
    assert.deepStrictEqual(JSON.parse(events[0].data), { error: 'LLM connection error' });
  });
});
