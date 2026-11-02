import test from 'node:test';
import assert from 'node:assert';
import { BedrockEmbeddingService } from './bedrock-embedding.service.js';

test('BedrockEmbeddingService unit tests', async (t) => {
  await t.test('getEmbedding returns formatted vector on successful Bedrock call', async () => {
    // given
    const requestedTexts: string[] = [];
    const mockBedrockService = {
      generateTextEmbedding: async (text: string) => {
        requestedTexts.push(text);
        return [0.123, 0.456, 0.789];
      },
    } as any;
    const service = new BedrockEmbeddingService(mockBedrockService);

    // when
    const result = await service.getEmbedding('Hello knowledge retrieval');

    // then
    assert.strictEqual(result, '[0.123,0.456,0.789]');
    assert.strictEqual(requestedTexts.length, 1);
    assert.strictEqual(requestedTexts[0], 'Hello knowledge retrieval');
  });

  await t.test('getEmbedding falls back to deterministic vector on Bedrock error', async () => {
    // given
    const mockBedrockService = {
      generateTextEmbedding: async () => {
        throw new Error('Bedrock rate limit');
      },
    } as any;
    const service = new BedrockEmbeddingService(mockBedrockService);

    // when
    const result = await service.getEmbedding('Fallback text');

    // then
    assert.ok(result.startsWith('['));
    assert.ok(result.endsWith(']'));
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.length, 1024);
  });

  await t.test('getImageEmbedding returns formatted vector on successful call', async () => {
    // given
    const requestedImages: string[] = [];
    const mockBedrockService = {
      generateImageEmbedding: async (base64: string) => {
        requestedImages.push(base64);
        return [0.99, 0.88];
      },
    } as any;
    const service = new BedrockEmbeddingService(mockBedrockService);

    // when
    const result = await service.getImageEmbedding('image_base64_data');

    // then
    assert.strictEqual(result, '[0.99,0.88]');
    assert.strictEqual(requestedImages.length, 1);
    assert.strictEqual(requestedImages[0], 'image_base64_data');
  });

  await t.test('getImageEmbedding falls back to deterministic vector on error', async () => {
    // given
    const mockBedrockService = {
      generateImageEmbedding: async () => {
        throw new Error('Bedrock image error');
      },
    } as any;
    const service = new BedrockEmbeddingService(mockBedrockService);

    // when
    const result = await service.getImageEmbedding('image_base64_data_error');

    // then
    assert.ok(result.startsWith('['));
    assert.ok(result.endsWith(']'));
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.length, 1024);
  });
});
