import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';
import { CitationAnchor, fitsWithinTokenLimit } from '@notebooklm/shared';

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  citationAnchor: CitationAnchor;
  isMultimodal: boolean;
  imageS3Key?: string;
}

@Injectable()
export class AstSplitterService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Splits Markdown along structural AST boundaries (# headings, paragraphs)
   * while respecting MAX_CHUNK_TOKENS with a token buffer.
   */
  splitMarkdown(
    markdown: string,
    sourceId: string,
    versionId: string,
    maxTokens?: number,
  ): DocumentChunk[] {
    const awsConfig = this.configService.get('aws');
    const tokenLimit = maxTokens || awsConfig.bedrock.maxChunkTokens || 1024;
    const safetyBuffer = 0.15; // 15% safety buffer

    const lines = markdown.split('\n');
    const chunks: DocumentChunk[] = [];

    let currentLines: string[] = [];
    let currentStartLine = 1;
    let chunkIndex = 0;

    const flushChunk = (endLine: number) => {
      const content = currentLines.join('\n').trim();
      if (content.length > 0) {
        const anchor: CitationAnchor = {
          anchor_id: uuidv7(),
          source_id: sourceId,
          version_id: versionId,
          markdown_line_start: currentStartLine,
          markdown_line_end: endLine,
          page_number: Math.max(1, Math.ceil(currentStartLine / 40)),
        };

        chunks.push({
          chunkIndex,
          content,
          citationAnchor: anchor,
          isMultimodal: false,
        });
        chunkIndex++;
      }
      currentLines = [];
      currentStartLine = endLine + 1;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeading = /^#{1,3}\s+/.test(line);
      const isParagraphBreak = line.trim() === '' && currentLines.length > 5;

      // Check if adding this line exceeds the safe token threshold
      const candidateContent = [...currentLines, line].join('\n');
      const fits = fitsWithinTokenLimit(candidateContent, tokenLimit, safetyBuffer);

      if (!fits || (isHeading && currentLines.length > 0) || isParagraphBreak) {
        if (currentLines.length > 0) {
          flushChunk(i);
        }
      }

      currentLines.push(line);
    }

    if (currentLines.length > 0) {
      flushChunk(lines.length);
    }

    return chunks;
  }
}
