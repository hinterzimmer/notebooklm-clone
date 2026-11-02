import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Sse,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { CognitoAuthGuard } from '../../auth/cognito.guard.js';
import { ChatService } from './chat.service.js';

@Controller()
@UseGuards(CognitoAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('notebooks/:id/threads')
  async createThread(
    @Param('id') notebookId: string,
    @Body('title') title?: string,
  ) {
    return await this.chatService.createThread(notebookId, title);
  }

  @Get('notebooks/:id/threads')
  async listThreads(@Param('id') notebookId: string) {
    return await this.chatService.listThreads(notebookId);
  }

  @Get('threads/:id')
  async getThread(@Param('id') threadId: string) {
    return await this.chatService.getThread(threadId);
  }

  @Patch('threads/:id')
  async updateThread(
    @Param('id') threadId: string,
    @Body() body: { title?: string; notebookId?: string },
  ) {
    return await this.chatService.updateThread(threadId, body);
  }

  @Delete('threads/:id')
  async deleteThread(@Param('id') threadId: string) {
    return await this.chatService.deleteThread(threadId);
  }

  @Get('threads/:id/messages')
  async getMessages(
    @Param('id') threadId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 50,
  ) {
    return await this.chatService.getMessages(threadId, cursor, Number(limit));
  }

  @Post('threads/:id/messages')
  async postMessage(
    @Param('id') threadId: string,
    @Body('content') content: string,
  ) {
    let result: any;
    await this.chatService.executeChatTurnStream(threadId, content, () => {});
    const messages = await this.chatService.getMessages(threadId);
    return messages[messages.length - 1];
  }

  @Sse('threads/:id/stream')
  streamTurn(
    @Param('id') threadId: string,
    @Query('message') message: string,
  ): Observable<{ data: string }> {
    const subject = new Subject<{ data: string }>();

    (async () => {
      try {
        await this.chatService.executeChatTurnStream(
          threadId,
          message || 'Hello',
          (delta) => {
            subject.next({ data: JSON.stringify(delta) });
          },
        );
        subject.next({ data: JSON.stringify({ done: true }) });
        subject.complete();
      } catch (err: any) {
        subject.next({
          data: JSON.stringify({ error: err?.message || 'Chat turn error' }),
        });
        subject.complete();
      }
    })();

    return subject.asObservable();
  }
}
