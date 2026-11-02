import test from 'node:test';
import assert from 'node:assert';
import { GuardrailsService } from './guardrails.service.js';

test('GuardrailsService unit tests', async (t) => {
  await t.test('validateInput returns allowed: true when Bedrock action is NONE', async () => {
    // given
    const mockBedrockService = {
      applyGuardrail: async (text: string, source: string) => {
        assert.strictEqual(source, 'INPUT');
        return { action: 'NONE' };
      },
    } as any;
    const service = new GuardrailsService(mockBedrockService);

    // when
    const result = await service.validateInput('Valid query text');

    // then
    assert.deepStrictEqual(result, { allowed: true });
  });

  await t.test('validateInput returns allowed: false with reason when guardrail intervened', async () => {
    // given
    const mockBedrockService = {
      applyGuardrail: async () => ({
        action: 'GUARDRAIL_INTERVENED',
        outputs: ['Harmful prompt blocked by policy'],
      }),
    } as any;
    const service = new GuardrailsService(mockBedrockService);

    // when
    const result = await service.validateInput('Malicious input prompt');

    // then
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Harmful prompt blocked by policy');
  });

  await t.test('validateInput provides fallback reason if intervened without outputs', async () => {
    // given
    const mockBedrockService = {
      applyGuardrail: async () => ({
        action: 'GUARDRAIL_INTERVENED',
      }),
    } as any;
    const service = new GuardrailsService(mockBedrockService);

    // when
    const result = await service.validateInput('Bad input');

    // then
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'Content blocked by Bedrock Guardrails (policy violation)');
  });

  await t.test('validateOutput returns allowed: true when Bedrock action is NONE', async () => {
    // given
    const mockBedrockService = {
      applyGuardrail: async (text: string, source: string) => {
        assert.strictEqual(source, 'OUTPUT');
        return { action: 'NONE' };
      },
    } as any;
    const service = new GuardrailsService(mockBedrockService);

    // when
    const result = await service.validateOutput('Safe response text');

    // then
    assert.deepStrictEqual(result, { allowed: true });
  });

  await t.test('validateOutput returns allowed: false with reason when output blocked', async () => {
    // given
    const mockBedrockService = {
      applyGuardrail: async () => ({
        action: 'GUARDRAIL_INTERVENED',
        outputs: ['PII detected in response'],
      }),
    } as any;
    const service = new GuardrailsService(mockBedrockService);

    // when
    const result = await service.validateOutput('Sensitive response');

    // then
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'PII detected in response');
  });

  await t.test('validateOutput provides fallback reason when intervened without outputs', async () => {
    // given
    const mockBedrockService = {
      applyGuardrail: async () => ({
        action: 'GUARDRAIL_INTERVENED',
      }),
    } as any;
    const service = new GuardrailsService(mockBedrockService);

    // when
    const result = await service.validateOutput('Sensitive text');

    // then
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(
      result.reason,
      'Response blocked by Bedrock Guardrails (grounding/PII violation)',
    );
  });
});
