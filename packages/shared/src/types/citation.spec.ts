import test from 'node:test';
import assert from 'node:assert';
import { isCitationAnchor, CitationAnchor } from './citation.js';

test('CitationAnchor validator tests', async (t) => {
  await t.test('validates correct CitationAnchor object', () => {
    const anchor: CitationAnchor = {
      anchor_id: '0195ef30-8b2a-7c10-9f1a-4b6d8e9a1023',
      source_id: '0195ef2c-1040-7a00-8122-9c3d4e5f6071',
      version_id: '0195ef2d-5512-7b31-a890-1a2b3c4d5e6f',
      page_number: 14,
      markdown_line_start: 120,
      markdown_line_end: 145,
      bounding_box: { top: 0.12, left: 0.08, width: 0.84, height: 0.22 },
    };

    assert.strictEqual(isCitationAnchor(anchor), true);
  });

  await t.test('rejects invalid or incomplete objects', () => {
    assert.strictEqual(isCitationAnchor(null), false);
    assert.strictEqual(isCitationAnchor({}), false);
    assert.strictEqual(isCitationAnchor({ anchor_id: '123' }), false);
  });
});
