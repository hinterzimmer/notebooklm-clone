import test from 'node:test';
import assert from 'node:assert';
import { BedrockService } from './bedrock.service.js';

test('BedrockService unit tests', async (t) => {
  const createMockConfig = (guardrailId?: string, accessKeyId = 'AKIAIOSFODNN7EXAMPLE', sessionToken?: string) =>
    ({
      get: (key: string) => {
        if (key === 'aws') {
          return {
            region: 'us-east-1',
            accessKeyId,
            secretAccessKey: 'mock-secret',
            sessionToken,
            bedrock: {
              chatModel: 'anthropic.claude-3-haiku',
              embeddingModel: 'amazon.titan-embed-text-v2:0',
              embeddingDimensions: 1024,
              multimodalModel: 'amazon.titan-embed-image-v1',
              guardrailId,
              guardrailVersion: '1',
            },
          };
        }
        return {};
      },
    } as any);

  await t.test('constructor attaches session token for STS temporary credentials (ASIA...)', () => {
    // given
    const stsConfig = createMockConfig('guard-1', 'ASIA_STS_KEY', 'sts_token_123');

    // when
    const service = new BedrockService(stsConfig);

    // then
    assert.ok(service.runtimeClient);
  });

  await t.test('generateTextEmbedding sends InvokeModelCommand and parses embedding array', async () => {
    // given
    const service = new BedrockService(createMockConfig());
    const sentCommands: any[] = [];
    (service.runtimeClient as any).send = async (cmd: any) => {
      sentCommands.push(cmd);
      const resBody = { embedding: [0.1, 0.2, 0.3] };
      return { body: Buffer.from(JSON.stringify(resBody)) };
    };

    // when
    const embedding = await service.generateTextEmbedding('Hello titan');

    // then
    assert.deepStrictEqual(embedding, [0.1, 0.2, 0.3]);
    assert.strictEqual(sentCommands.length, 1);
    assert.strictEqual(sentCommands[0].input.modelId, 'amazon.titan-embed-text-v2:0');
    const payload = JSON.parse(Buffer.from(sentCommands[0].input.body).toString('utf-8'));
    assert.strictEqual(payload.inputText, 'Hello titan');
    assert.strictEqual(payload.dimensions, 1024);
    assert.strictEqual(payload.normalize, true);
  });

  await t.test('generateImageEmbedding sends InvokeModelCommand with multimodal payload', async () => {
    // given
    const service = new BedrockService(createMockConfig());
    const sentCommands: any[] = [];
    (service.runtimeClient as any).send = async (cmd: any) => {
      sentCommands.push(cmd);
      const resBody = { embedding: [0.9, 0.8, 0.7] };
      return { body: Buffer.from(JSON.stringify(resBody)) };
    };
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // when
    const embedding = await service.generateImageEmbedding(base64Image);

    // then
    assert.deepStrictEqual(embedding, [0.9, 0.8, 0.7]);
    assert.strictEqual(sentCommands.length, 1);
    assert.strictEqual(sentCommands[0].input.modelId, 'amazon.titan-embed-image-v1');
    const payload = JSON.parse(Buffer.from(sentCommands[0].input.body).toString('utf-8'));
    assert.strictEqual(payload.inputImage, base64Image);
    assert.strictEqual(payload.embeddingConfig.outputEmbeddingLength, 1024);
  });

  await t.test('converseWithDocument converts md to txt and extracts text block response', async () => {
    // given
    const service = new BedrockService(createMockConfig());
    const sentCommands: any[] = [];
    (service.runtimeClient as any).send = async (cmd: any) => {
      sentCommands.push(cmd);
      return {
        output: {
          message: {
            content: [{ text: 'Parsed document markdown' }],
          },
        },
      };
    };
    const docBytes = Buffer.from('# Test');

    // when
    const result = await service.converseWithDocument(docBytes, 'md', 'System prompt', 'User prompt');

    // then
    assert.strictEqual(result, 'Parsed document markdown');
    assert.strictEqual(sentCommands.length, 1);
    const docBlock = sentCommands[0].input.messages[0].content[0].document;
    assert.strictEqual(docBlock.format, 'txt'); // md converted to txt
    assert.strictEqual(docBlock.source.bytes, docBytes);
  });

  await t.test('applyGuardrail returns NONE if guardrailId is not set', async () => {
    // given
    const service = new BedrockService(createMockConfig(undefined)); // no guardrailId

    // when
    const result = await service.applyGuardrail('Some input text', 'INPUT');

    // then
    assert.deepStrictEqual(result, { action: 'NONE' });
  });

  await t.test('applyGuardrail returns GUARDRAIL_INTERVENED with outputs when policy violated', async () => {
    // given
    const service = new BedrockService(createMockConfig('guard-id-123'));
    (service.runtimeClient as any).send = async () => ({
      action: 'GUARDRAIL_INTERVENED',
      outputs: [{ text: 'Blocked content violation' }],
    });

    // when
    const result = await service.applyGuardrail('Restricted text', 'INPUT');

    // then
    assert.strictEqual(result.action, 'GUARDRAIL_INTERVENED');
    assert.deepStrictEqual(result.outputs, ['Blocked content violation']);
  });

  await t.test('applyGuardrail catches errors and returns NONE', async () => {
    // given
    const service = new BedrockService(createMockConfig('guard-id-123'));
    (service.runtimeClient as any).send = async () => {
      throw new Error('Guardrail service unavailable');
    };

    // when
    const result = await service.applyGuardrail('Some text', 'OUTPUT');

    // then
    assert.strictEqual(result.action, 'NONE');
  });
});
