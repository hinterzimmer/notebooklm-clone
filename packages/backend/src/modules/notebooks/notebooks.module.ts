import { Module } from '@nestjs/common';
import { NotebooksService } from './notebooks.service.js';
import { NotebooksController } from './notebooks.controller.js';
import { AuthModule } from '../../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  providers: [NotebooksService],
  controllers: [NotebooksController],
  exports: [NotebooksService],
})
export class NotebooksModule {}
