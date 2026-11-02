import { SearchIntent, RetrievedBlock, IngestionStatus } from '@notebooklm/shared';
import { DocumentChunk } from '../ingestion/splitters/ast.splitter.js';

export interface IngestionContext {
  notebookId: string;
  sourceId: string;
  versionId: string;
  ownerId: string;
  rawMarkdown: string;
  chunks: DocumentChunk[];
}

export interface IIngestionStrategy {
  readonly strategyName: 'hybrid_rag' | 'open_kg';
  indexDocument(context: IngestionContext): Promise<void>;
}

export interface IRetrievalStrategy {
  readonly strategyName: 'hybrid_rag' | 'open_kg';
  retrieve(
    intent: SearchIntent,
    pinnedVersionIds: string[],
    limit?: number,
  ): Promise<RetrievedBlock[]>;
}
