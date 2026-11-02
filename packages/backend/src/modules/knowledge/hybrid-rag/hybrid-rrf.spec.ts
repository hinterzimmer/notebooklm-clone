import test from 'node:test';
import assert from 'node:assert';
import { HybridRrfStrategy } from './hybrid-rrf.strategy.js';
import { IngestionContext } from '../knowledge.interface.js';
import { SearchIntent } from '@notebooklm/shared';

test('HybridRrfStrategy unit tests', async (t) => {
  await t.test('retrieve returns empty array immediately when pinnedVersionIds is empty', async () => {
    // given
    let dbCalled = false;
    let embeddingCalled = false;
    const mockDbService = {
      withReadTransaction: async () => {
        dbCalled = true;
      },
    } as any;
    const mockEmbeddingService = {
      getEmbedding: async () => {
        embeddingCalled = true;
        return '[0.1, 0.2]';
      },
    } as any;
    const strategy = new HybridRrfStrategy(mockDbService, mockEmbeddingService);
    const intent: SearchIntent = {
      raw_query: 'test query',
      intent: 'information_retrieval',
      target_entities: [],
      sub_queries: ['test query'],
    };

    // when
    const results = await strategy.retrieve(intent, []);

    // then
    assert.deepStrictEqual(results, []);
    assert.strictEqual(dbCalled, false, 'Database should not be called');
    assert.strictEqual(embeddingCalled, false, 'Embedding service should not be called');
  });

  await t.test('retrieve successfully executes RRF query and maps returned rows', async () => {
    // given
    const queryCalls: any[] = [];
    const embeddingCalls: string[] = [];
    const mockDbService = {
      withReadTransaction: async (cb: any) => {
        const client = {
          query: async (sql: string, params: any[]) => {
            queryCalls.push({ sql, params });
            return {
              rows: [
                {
                  chunk_id: 'c1',
                  source_id: 's1',
                  version_id: 'v1',
                  content: 'Test content',
                  score: '0.032',
                  citation_anchor: JSON.stringify({ anchor_id: 'a1', markdown_line_start: 1 }),
                  is_multimodal: false,
                  image_s3_key: null,
                },
              ],
            };
          },
        };
        return await cb(client);
      },
    } as any;
    const mockEmbeddingService = {
      getEmbedding: async (text: string) => {
        embeddingCalls.push(text);
        return '[0.1, 0.2, 0.3]';
      },
    } as any;
    const strategy = new HybridRrfStrategy(mockDbService, mockEmbeddingService);
    const intent: SearchIntent = {
      raw_query: 'quantum computing',
      intent: 'information_retrieval',
      target_entities: [],
      sub_queries: ['quantum computing'],
    };
    const pinnedVersionIds = ['v1'];

    // when
    const results = await strategy.retrieve(intent, pinnedVersionIds, 5);

    // then
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].chunk_id, 'c1');
    assert.strictEqual(results[0].score, 0.032);
    assert.strictEqual(results[0].citation_anchor.anchor_id, 'a1');
    assert.strictEqual(embeddingCalls.length, 1);
    assert.strictEqual(embeddingCalls[0], 'quantum computing');
    assert.strictEqual(queryCalls.length, 1);
    assert.strictEqual(queryCalls[0].params[0], '[0.1, 0.2, 0.3]');
    assert.deepStrictEqual(queryCalls[0].params[1], ['v1']);
    assert.strictEqual(queryCalls[0].params[2], 'quantum | computing');
    assert.strictEqual(queryCalls[0].params[3], 5);
  });

  await t.test('retrieve falls back to vector-only search when RRF query fails', async () => {
    // given
    const fallbackCalls: any[] = [];
    const mockDbService = {
      withReadTransaction: async () => {
        throw new Error('tsquery syntax error');
      },
      query: async (sql: string, params: any[], useWritePool: boolean) => {
        fallbackCalls.push({ sql, params, useWritePool });
        return {
          rows: [
            {
              chunk_id: 'fallback-c1',
              source_id: 's1',
              version_id: 'v1',
              content: 'Fallback content',
              citation_anchor: { anchor_id: 'a1' },
              is_multimodal: false,
              image_s3_key: null,
              score: 1.0,
            },
          ],
        };
      },
    } as any;
    const mockEmbeddingService = {
      getEmbedding: async () => '[0.5, 0.5]',
    } as any;
    const strategy = new HybridRrfStrategy(mockDbService, mockEmbeddingService);
    const intent: SearchIntent = {
      raw_query: 'syntax error query *',
      intent: 'information_retrieval',
      target_entities: [],
      sub_queries: [],
    };

    // when
    const results = await strategy.retrieve(intent, ['v1']);

    // then
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].chunk_id, 'fallback-c1');
    assert.strictEqual(fallbackCalls.length, 1);
    assert.strictEqual(fallbackCalls[0].useWritePool, false);
    assert.deepStrictEqual(fallbackCalls[0].params, [['v1'], '[0.5, 0.5]', 6]);
  });

  await t.test('indexDocument indexes chunks within a write transaction', async () => {
    // given
    const insertedChunks: any[] = [];
    const mockDbService = {
      withWriteTransaction: async (cb: any) => {
        const client = {
          query: async (sql: string, params: any[]) => {
            insertedChunks.push({ sql, params });
          },
        };
        return await cb(client);
      },
    } as any;
    const mockEmbeddingService = {
      getEmbedding: async (text: string) => `[emb_${text}]`,
    } as any;
    const strategy = new HybridRrfStrategy(mockDbService, mockEmbeddingService);
    const context: IngestionContext = {
      notebookId: 'nb-1',
      sourceId: 'src-1',
      versionId: 'ver-1',
      ownerId: 'user-1',
      rawMarkdown: 'sample text',
      chunks: [
        {
          chunkIndex: 0,
          content: 'chunk zero',
          citationAnchor: { anchor_id: 'a0' } as any,
          isMultimodal: false,
          imageS3Key: undefined,
        },
      ],
    };

    // when
    await strategy.indexDocument(context);

    // then
    assert.strictEqual(insertedChunks.length, 1);
    const params = insertedChunks[0].params;
    assert.strictEqual(params[0], 'src-1');
    assert.strictEqual(params[1], 'ver-1');
    assert.strictEqual(params[2], 'user-1');
    assert.strictEqual(params[3], 0);
    assert.strictEqual(params[4], 'chunk zero');
    assert.strictEqual(params[5], '[emb_chunk zero]');
    assert.strictEqual(params[6], JSON.stringify({ anchor_id: 'a0' }));
    assert.strictEqual(params[7], false);
    assert.strictEqual(params[8], null);
  });
});
