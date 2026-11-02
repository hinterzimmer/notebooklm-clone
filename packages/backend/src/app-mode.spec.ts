import test from 'node:test';
import assert from 'node:assert';
import { AppModule } from './app.module.js';
import { ApiModule } from './api.module.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';

test('AppModule wiring tests', async (t) => {
  await t.test('AppModule imports both ApiModule and IngestionModule', () => {
    // given
    const mode = 'ALL';

    // when
    const dynamicModule = AppModule.forRoot(mode);
    const imports = dynamicModule.imports as any[];

    // then
    assert.ok(imports.includes(ApiModule), 'Should contain ApiModule');
    assert.ok(imports.includes(IngestionModule), 'Should contain IngestionModule');
    assert.strictEqual(dynamicModule.module, AppModule);
  });
});
