import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { GuardrailsService } from './guardrails.service.js';
import { AuthModule } from '../../auth/auth.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';

@Module({
  imports: [AuthModule, KnowledgeModule],
  providers: [ChatService, GuardrailsService],
  controllers: [ChatController],
  exports: [ChatService, GuardrailsService],
})
export class ChatModule {}
