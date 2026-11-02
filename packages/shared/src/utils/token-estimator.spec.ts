import test from 'node:test';
import assert from 'node:assert';
import {
  estimateTokens,
  fitsWithinTokenLimit,
  DEFAULT_MAX_CHUNK_TOKENS,
  DEFAULT_EMBEDDING_DIMENSIONS,
} from './token-estimator.js';

test('Token Estimator tests', async (t) => {
  await t.test('estimateTokens returns 0 for empty string', () => {
    assert.strictEqual(estimateTokens(''), 0);
  });

  await t.test('estimateTokens computes safe estimates for prose', () => {
    const sampleText = 'This is an enterprise grade document chunk for NotebookLM.';
    const tokens = estimateTokens(sampleText);
    assert.ok(tokens > 5, 'Tokens should be greater than 5');
    assert.ok(tokens < 30, 'Tokens should be less than 30');
  });

  await t.test('fitsWithinTokenLimit respects buffer threshold', () => {
    const smallText = 'Hello world! A tiny test chunk.';
    assert.strictEqual(fitsWithinTokenLimit(smallText, 100, 0.15), true);

    // Large text exceeding 50 tokens
    const longText = 'word '.repeat(100);
    assert.strictEqual(fitsWithinTokenLimit(longText, 50, 0.15), false);
  });

  await t.test('MAX_CHUNK_TOKENS and EMBEDDING_DIMENSIONS are distinct', () => {
    assert.strictEqual(DEFAULT_MAX_CHUNK_TOKENS, 1024);
    assert.strictEqual(DEFAULT_EMBEDDING_DIMENSIONS, 1024);
    // Can test with different token limits independently of embedding dimension
    const mediumText = 'lorem ipsum '.repeat(300);
    assert.strictEqual(fitsWithinTokenLimit(mediumText, 8192, 0.15), true);
  });
});
