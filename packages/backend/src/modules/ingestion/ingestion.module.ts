import { Module } from '@nestjs/common';
import { AstSplitterService } from './splitters/ast.splitter.js';
import { IngestionService } from './ingestion.service.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';

@Module({
  imports: [KnowledgeModule],
  providers: [
    AstSplitterService,
    IngestionService,
  ],
  exports: [
    AstSplitterService,
    IngestionService,
  ],
})
export class IngestionModule {}
