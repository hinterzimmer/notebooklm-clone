import test from 'node:test';
import assert from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { SourcesController } from './sources.controller.js';

test('SourcesController unit tests', async (t) => {
  await t.test('uploadSource throws BadRequestException when file is missing', async () => {
    // given
    const controller = new SourcesController({} as any);

    // when
    let error: any;
    try {
      await controller.uploadSource('nb-1', undefined as any);
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof BadRequestException);
    assert.strictEqual(error.message, 'No file uploaded');
  });

  await t.test('uploadSource delegates to sourcesService.uploadSource when file is present', async () => {
    // given
    const uploadCalls: any[] = [];
    const mockService = {
      uploadSource: async (notebookId: string, file: any) => {
        uploadCalls.push({ notebookId, file });
        return { sourceId: 'src-1', isDeduplicated: false };
      },
    } as any;
    const controller = new SourcesController(mockService);
    const mockFile = { originalname: 'paper.pdf' } as any;

    // when
    const result = await controller.uploadSource('nb-100', mockFile);

    // then
    assert.strictEqual(result.sourceId, 'src-1');
    assert.strictEqual(uploadCalls.length, 1);
    assert.strictEqual(uploadCalls[0].notebookId, 'nb-100');
    assert.strictEqual(uploadCalls[0].file, mockFile);
  });

  await t.test('listSources delegates to sourcesService.listSources', async () => {
    // given
    const mockService = {
      listSources: async (id: string) => [{ id: 'src-1', notebook_id: id }],
    } as any;
    const controller = new SourcesController(mockService);

    // when
    const result = await controller.listSources('nb-200');

    // then
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].notebook_id, 'nb-200');
  });

  await t.test('listVersions delegates to sourcesService.listVersions', async () => {
    // given
    const mockService = {
      listVersions: async (id: string) => [{ id: 'ver-1', source_id: id }],
    } as any;
    const controller = new SourcesController(mockService);

    // when
    const result = await controller.listVersions('src-200');

    // then
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].source_id, 'src-200');
  });
});
