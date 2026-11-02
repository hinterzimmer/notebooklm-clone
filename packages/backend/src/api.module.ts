import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { NotebooksModule } from './modules/notebooks/notebooks.module.js';
import { SourcesModule } from './modules/sources/sources.module.js';
import { ChatModule } from './modules/chat/chat.module.js';

@Module({
  imports: [AuthModule, NotebooksModule, SourcesModule, ChatModule],
  exports: [AuthModule, NotebooksModule, SourcesModule, ChatModule],
})
export class ApiModule {}

