import test from 'node:test';
import assert from 'node:assert';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service.js';

test('ChatService unit tests', async (t) => {
  const createMockConfig = () =>
    ({
      get: (key: string) => {
        if (key === 'aws') {
          return {
            bedrock: {
              chatModel: 'anthropic.claude-3-haiku',
            },
          };
        }
        return {};
      },
    } as any);

  await t.test('createThread creates thread and snapshots pinned versions in transaction', async () => {
    // given
    const txQueries: any[] = [];
    const mockDbService = {
      withWriteTransaction: async (cb: any) => {
        const client = {
          query: async (sql: string, params: any[]) => {
            txQueries.push({ sql, params });
          },
        };
        return await cb(client);
      },
      query: async (sql: string, params: any[]) => {
        return {
          rows: [
            {
              id: params[0],
              notebook_id: 'nb-1',
              title: 'Custom Conversation',
              strategy: 'hybrid_rag',
            },
          ],
        };
      },
    } as any;
    const mockUserContext = {
      getUserId: () => 'user-chat-1',
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      mockUserContext,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    const thread = await service.createThread('nb-1', 'Custom Conversation');

    // then
    assert.strictEqual(thread.notebook_id, 'nb-1');
    assert.strictEqual(thread.title, 'Custom Conversation');
    assert.strictEqual(txQueries.length, 2);
    assert.ok(txQueries[0].sql.includes('INSERT INTO chat_threads'));
    assert.strictEqual(txQueries[0].params[1], 'nb-1');
    assert.strictEqual(txQueries[0].params[2], 'user-chat-1');
    assert.strictEqual(txQueries[0].params[3], 'Custom Conversation');

    assert.ok(txQueries[1].sql.includes('INSERT INTO chat_thread_pinned_versions'));
    assert.strictEqual(txQueries[1].params[1], 'user-chat-1');
    assert.strictEqual(txQueries[1].params[2], 'nb-1');
  });

  await t.test('getThread throws NotFoundException when thread does not exist', async () => {
    // given
    const mockDbService = {
      query: async () => ({ rows: [] }),
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    let error: any;
    try {
      await service.getThread('missing-thread');
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof NotFoundException);
    assert.strictEqual(error.message, 'Thread missing-thread not found');
  });

  await t.test('listThreads returns threads for notebook', async () => {
    // given
    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        return { rows: [{ id: 't1', notebook_id: params[0], title: 'T1' }] };
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    const threads = await service.listThreads('nb-list');

    // then
    assert.strictEqual(threads.length, 1);
    assert.strictEqual(threads[0].id, 't1');
  });

  await t.test('updateThread updates title and notebookId', async () => {
    // given
    const updateQueries: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes('SELECT t.id')) {
          return { rows: [{ id: 't-up', title: 'Old Title', notebook_id: 'nb-old' }] };
        }
        if (sql.includes('UPDATE chat_threads')) {
          updateQueries.push({ sql, params });
          return { rows: [] };
        }
        return { rows: [] };
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    await service.updateThread('t-up', { title: 'Renamed Title', notebookId: 'nb-new' });

    // then
    assert.strictEqual(updateQueries.length, 1);
    assert.ok(updateQueries[0].sql.includes('title = $1'));
    assert.ok(updateQueries[0].sql.includes('notebook_id = $2'));
    assert.deepStrictEqual(updateQueries[0].params, ['Renamed Title', 'nb-new', 't-up']);
  });

  await t.test('updateThread returns existing thread if updates object is empty', async () => {
    // given
    let updateExecuted = false;
    const mockDbService = {
      query: async (sql: string) => {
        if (sql.includes('UPDATE chat_threads')) {
          updateExecuted = true;
        }
        return { rows: [{ id: 't-no-up', title: 'Unchanged' }] };
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    const thread = await service.updateThread('t-no-up', {});

    // then
    assert.strictEqual(thread.title, 'Unchanged');
    assert.strictEqual(updateExecuted, false);
  });

  await t.test('deleteThread deletes thread after checking existence', async () => {
    // given
    const deletedThreads: string[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes('SELECT t.id')) {
          return { rows: [{ id: params[0] }] };
        }
        if (sql.includes('DELETE FROM chat_threads')) {
          deletedThreads.push(params[0]);
        }
        return { rows: [] };
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    const result = await service.deleteThread('t-del');

    // then
    assert.deepStrictEqual(result, { success: true, id: 't-del' });
    assert.strictEqual(deletedThreads.length, 1);
    assert.strictEqual(deletedThreads[0], 't-del');
  });

  await t.test('getMessages queries messages with or without pagination cursor', async () => {
    // given
    const queryCalls: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        queryCalls.push({ sql, params });
        return { rows: [{ id: 'm1', content: 'test message' }] };
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // when
    const resWithoutCursor = await service.getMessages('t-msg', undefined, 20);
    const resWithCursor = await service.getMessages('t-msg', 'm1', 10);

    // then
    assert.strictEqual(resWithoutCursor.length, 1);
    assert.strictEqual(queryCalls[0].params.length, 2);
    assert.deepStrictEqual(queryCalls[0].params, ['t-msg', 20]);

    assert.strictEqual(resWithCursor.length, 1);
    assert.strictEqual(queryCalls[1].params.length, 3);
    assert.deepStrictEqual(queryCalls[1].params, ['t-msg', 'm1', 10]);
  });

  await t.test('generateConversationTitle generates title from Bedrock Converse and cleans words', async () => {
    // given
    const mockBedrockService = {
      runtimeClient: {
        send: async () => ({
          output: {
            message: {
              content: [{ text: '"Quantum Computing Fundamentals Overview"' }],
            },
          },
        }),
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      {} as any,
      {} as any,
      {} as any,
      mockBedrockService,
      {} as any,
      {} as any,
    );

    // when
    const title = await service.generateConversationTitle('What is quantum computing?');

    // then
    assert.strictEqual(title, 'Quantum Computing Fundamentals Overview');
  });

  await t.test('generateConversationTitle falls back to regex cleaner when Bedrock fails', async () => {
    // given
    const mockBedrockService = {
      runtimeClient: {
        send: async () => {
          throw new Error('Bedrock rate limit');
        },
      },
    } as any;
    const service = new ChatService(
      createMockConfig(),
      {} as any,
      {} as any,
      {} as any,
      mockBedrockService,
      {} as any,
      {} as any,
    );

    // when
    const title = await service.generateConversationTitle('What is the latest revenue for Q3?');

    // then
    assert.strictEqual(title, 'Latest Revenue For Q3');
  });

  await t.test('executeChatTurnStream throws BadRequestException when input fails guardrails', async () => {
    // given
    const mockDbService = {
      query: async () => ({
        rows: [{ id: 't1', title: 'New Conversation', notebook_id: 'nb1' }],
      }),
    } as any;
    const mockGuardrails = {
      validateInput: async () => ({
        allowed: false,
        reason: 'Violates content safety policy',
      }),
    } as any;
    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      { getUserId: () => 'u1' } as any,
      {} as any,
      { runtimeClient: { send: async () => {} } } as any,
      mockGuardrails,
      {} as any,
    );

    // when
    let error: any;
    try {
      await service.executeChatTurnStream('t1', 'unsafe prompt', () => {});
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof BadRequestException);
    assert.strictEqual(error.message, 'Violates content safety policy');
  });

  await t.test('executeChatTurnStream executes full stream pipeline with citations and synthetic fallback', async () => {
    // given
    const dbQueries: any[] = [];
    const deltas: any[] = [];
    const mockDbService = {
      query: async (sql: string, params: any[]) => {
        dbQueries.push({ sql, params });
        if (sql.includes('SELECT t.id, t.notebook_id')) {
          return { rows: [{ id: 't-stream', title: 'New Conversation', notebook_id: 'nb1' }] };
        }
        if (sql.includes('SELECT version_id FROM chat_thread_pinned_versions')) {
          return { rows: [{ version_id: 'ver-pinned-1' }] };
        }
        if (sql.includes('SELECT id, filename FROM sources')) {
          return { rows: [{ id: 'src-1', filename: 'Whitepaper.pdf' }] };
        }
        return { rows: [] };
      },
    } as any;

    const mockGuardrails = {
      validateInput: async () => ({ allowed: true }),
    } as any;

    const mockHybridStrategy = {
      retrieve: async () => [
        {
          chunk_id: 'c1',
          source_id: 'src-1',
          version_id: 'ver-pinned-1',
          content: 'Important research finding about solar energy.',
          score: 0.95,
          citation_anchor: { anchor_id: 'a1', page_number: 2 },
          is_multimodal: true,
          image_s3_key: 'images/solar.png',
        },
      ],
    } as any;

    const mockS3Service = {
      getPresignedUrl: async (key: string) => `https://s3.signed/${key}`,
    } as any;

    // Bedrock runtime mock that generates a stream with text delta citing [1]
    const streamChunks = [
      { contentBlockDelta: { delta: { reasoningContent: { text: 'Analyzing sources...' } } } },
      { contentBlockDelta: { delta: { text: 'Solar efficiency has risen to 32% according to [1].' } } },
    ];
    async function* asyncStream() {
      for (const ch of streamChunks) {
        yield ch;
      }
    }
    const mockBedrockService = {
      runtimeClient: {
        send: async () => ({
          stream: asyncStream(),
        }),
      },
    } as any;

    const service = new ChatService(
      createMockConfig(),
      mockDbService,
      { getUserId: () => 'user-1' } as any,
      mockS3Service,
      mockBedrockService,
      mockGuardrails,
      mockHybridStrategy,
    );

    // when
    const response = await service.executeChatTurnStream(
      't-stream',
      'What is solar efficiency?',
      (delta) => {
        deltas.push(delta);
      },
    );

    // then
    assert.strictEqual(response.role, 'assistant');
    assert.ok(response.content.includes('Solar efficiency has risen to 32% according to [1].'));
    assert.strictEqual(response.citations.length, 1);
    assert.strictEqual(response.citations[0].filename, 'Whitepaper.pdf');
    assert.strictEqual(response.citations[0].index, 1);

    // Verify deltas were emitted
    assert.ok(deltas.some((d) => d.delta));
    assert.ok(deltas.some((d) => d.citations));

    // Verify user and assistant messages were inserted
    const insertAssistant = dbQueries.find(
      (q) => q.sql.includes('INSERT INTO chat_messages') && q.sql.includes("'assistant'"),
    );
    assert.ok(insertAssistant);
    assert.strictEqual(insertAssistant.params[1], 't-stream');
    assert.strictEqual(insertAssistant.params[2], 'user-1');
  });
});
