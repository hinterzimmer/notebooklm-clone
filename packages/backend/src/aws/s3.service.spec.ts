import test from 'node:test';
import assert from 'node:assert';
import { S3Service } from './s3.service.js';
import { Readable } from 'node:stream';

test('S3Service unit tests', async (t) => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'aws') {
        return {
          region: 'us-east-1',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          floci: {
            s3Bucket: 'test-bucket',
            endpoint: 'http://localhost:4566',
          },
        };
      }
      return {};
    },
  } as any;

  await t.test('uploadBuffer sends PutObjectCommand with correct parameters', async () => {
    // given
    const service = new S3Service(mockConfigService);
    const sentCommands: any[] = [];
    (service.s3Client as any).send = async (cmd: any) => {
      sentCommands.push(cmd);
      return {};
    };
    const key = 'test/file.txt';
    const buffer = Buffer.from('hello world');
    const contentType = 'text/plain';

    // when
    await service.uploadBuffer(key, buffer, contentType);

    // then
    assert.strictEqual(sentCommands.length, 1);
    assert.strictEqual(sentCommands[0].input.Bucket, 'test-bucket');
    assert.strictEqual(sentCommands[0].input.Key, key);
    assert.strictEqual(sentCommands[0].input.Body, buffer);
    assert.strictEqual(sentCommands[0].input.ContentType, contentType);
  });

  await t.test('uploadText converts string to buffer and uploads', async () => {
    // given
    const service = new S3Service(mockConfigService);
    const sentCommands: any[] = [];
    (service.s3Client as any).send = async (cmd: any) => {
      sentCommands.push(cmd);
      return {};
    };

    // when
    await service.uploadText('notes/readme.md', '# Readme');

    // then
    assert.strictEqual(sentCommands.length, 1);
    assert.strictEqual(sentCommands[0].input.Key, 'notes/readme.md');
    assert.strictEqual(sentCommands[0].input.ContentType, 'text/markdown');
    assert.deepStrictEqual(sentCommands[0].input.Body, Buffer.from('# Readme', 'utf-8'));
  });

  await t.test('getObjectBuffer streams chunks and concatenates into Buffer', async () => {
    // given
    const service = new S3Service(mockConfigService);
    const stream = Readable.from([Buffer.from('chunk1 '), Buffer.from('chunk2')]);
    (service.s3Client as any).send = async () => ({ Body: stream });

    // when
    const resultBuffer = await service.getObjectBuffer('test/chunked.txt');

    // then
    assert.strictEqual(resultBuffer.toString('utf-8'), 'chunk1 chunk2');
  });

  await t.test('getObjectText returns decoded string', async () => {
    // given
    const service = new S3Service(mockConfigService);
    const stream = Readable.from([Buffer.from('Hello, UTF8 content!')]);
    (service.s3Client as any).send = async () => ({ Body: stream });

    // when
    const text = await service.getObjectText('test/text.txt');

    // then
    assert.strictEqual(text, 'Hello, UTF8 content!');
  });

  await t.test('objectExists returns true when HeadObjectCommand succeeds', async () => {
    // given
    const service = new S3Service(mockConfigService);
    (service.s3Client as any).send = async () => ({ ContentLength: 100 });

    // when
    const exists = await service.objectExists('existing-file.txt');

    // then
    assert.strictEqual(exists, true);
  });

  await t.test('objectExists returns false when HeadObjectCommand throws', async () => {
    // given
    const service = new S3Service(mockConfigService);
    (service.s3Client as any).send = async () => {
      throw new Error('NotFound');
    };

    // when
    const exists = await service.objectExists('missing-file.txt');

    // then
    assert.strictEqual(exists, false);
  });

  await t.test('onModuleInit ignores BucketAlreadyExists error', async () => {
    // given
    const service = new S3Service(mockConfigService);
    (service.s3Client as any).send = async () => {
      const err = new Error('Bucket already exists');
      err.name = 'BucketAlreadyOwnedByYou';
      throw err;
    };

    // when & then
    // Should not throw
    await service.onModuleInit();
    assert.ok(true, 'Initialization completed without throwing');
  });
});
