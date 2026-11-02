import { Module } from '@nestjs/common';
import { HybridRrfStrategy } from './hybrid-rag/hybrid-rrf.strategy.js';
import { BedrockEmbeddingService } from '../ingestion/embeddings/bedrock-embedding.service.js';

@Module({
  providers: [HybridRrfStrategy, BedrockEmbeddingService],
  exports: [HybridRrfStrategy, BedrockEmbeddingService],
})
export class KnowledgeModule {}
