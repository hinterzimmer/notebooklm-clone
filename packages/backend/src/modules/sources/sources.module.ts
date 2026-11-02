import { Module } from '@nestjs/common';
import { SourcesService } from './sources.service.js';
import { SourcesController } from './sources.controller.js';
import { AuthModule } from '../../auth/auth.module.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';

@Module({
  imports: [AuthModule, IngestionModule],
  providers: [SourcesService],
  controllers: [SourcesController],
  exports: [SourcesService],
})
export class SourcesModule {}
