import { CitationAnchor } from './citation.js';

export type KnowledgeStrategyType = 'hybrid_rag';

export type IngestionStatus =
  | 'UPLOADED'
  | 'BDA_PARSING'
  | 'HAIKU_SANITIZING'
  | 'SPLITTING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED';

export interface IngestionTelemetryEvent {
  notebook_id: string;
  source_id: string;
  version_id: string;
  status: IngestionStatus;
  processing_progress: number; // 0 - 100
  error_detail?: string;
  timestamp: string;
}

export interface SearchIntent {
  raw_query: string;
  intent: string;
  target_entities: string[];
  temporal_constraints?: string[];
  sub_queries: string[];
}

export interface RetrievedBlock {
  chunk_id: string;
  source_id: string;
  version_id: string;
  content: string;
  score: number;
  citation_anchor: CitationAnchor;
  is_multimodal?: boolean;
  image_s3_key?: string;
  image_url?: string;
}


