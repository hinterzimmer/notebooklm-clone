import test from 'node:test';
import assert from 'node:assert';
import { AstSplitterService } from './ast.splitter.js';

test('AstSplitterService tests', async (t) => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'aws') {
        return { bedrock: { maxChunkTokens: 50 } };
      }
      return null;
    },
  } as any;

  const splitter = new AstSplitterService(mockConfigService);

  await t.test('splits markdown along heading boundaries', () => {
    // given
    const md = `# Section 1\nThis is paragraph one.\n\n# Section 2\nThis is paragraph two.`;
    const sourceId = 'source-123';
    const versionId = 'version-456';

    // when
    const chunks = splitter.splitMarkdown(md, sourceId, versionId, 50);

    // then
    assert.strictEqual(chunks.length, 2);
    assert.strictEqual(chunks[0].chunkIndex, 0);
    assert.ok(chunks[0].content.includes('Section 1'));
    assert.strictEqual(chunks[1].chunkIndex, 1);
    assert.ok(chunks[1].content.includes('Section 2'));
    assert.ok(chunks[0].citationAnchor.anchor_id.length > 0);
    assert.strictEqual(chunks[0].citationAnchor.source_id, sourceId);
    assert.strictEqual(chunks[0].citationAnchor.version_id, versionId);
  });

  await t.test('preserves line numbers in CitationAnchor', () => {
    // given
    const md = `Line 1\nLine 2\nLine 3\n\n# Heading 2\nLine 5\nLine 6`;

    // when
    const chunks = splitter.splitMarkdown(md, 's1', 'v1', 50);

    // then
    assert.strictEqual(chunks[0].citationAnchor.markdown_line_start, 1);
    const lineStart = chunks[1].citationAnchor.markdown_line_start ?? 0;
    assert.ok(lineStart >= 4);
    assert.strictEqual(chunks[0].citationAnchor.page_number, 1);
  });

  await t.test('splits when token limit is exceeded without headings', () => {
    // given
    const longParagraph = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} with extra descriptive text.`).join('\n');

    // when
    const chunks = splitter.splitMarkdown(longParagraph, 's2', 'v2', 20);

    // then
    assert.ok(chunks.length > 1, 'Should split into multiple chunks due to tokenLimit');
    assert.strictEqual(chunks[0].chunkIndex, 0);
    assert.strictEqual(chunks[1].chunkIndex, 1);
  });

  await t.test('handles empty markdown input without producing chunks', () => {
    // given
    const emptyMd = '';

    // when
    const chunks = splitter.splitMarkdown(emptyMd, 's3', 'v3');

    // then
    assert.strictEqual(chunks.length, 0);
  });

  await t.test('splits on paragraph breaks after 5 lines', () => {
    // given
    const lines = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', '', 'new paragraph l8'];
    const md = lines.join('\n');

    // when
    const chunks = splitter.splitMarkdown(md, 's4', 'v4', 500);

    // then
    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].content.includes('l1'));
    assert.ok(chunks[1].content.includes('new paragraph'));
  });
});
