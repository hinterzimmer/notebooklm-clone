import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Sse,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CognitoAuthGuard } from '../../auth/cognito.guard.js';
import { NotebooksService, CreateNotebookDto } from './notebooks.service.js';
import { TelemetryService } from '../../database/telemetry.service.js';

@Controller('notebooks')
@UseGuards(CognitoAuthGuard)
export class NotebooksController {
  constructor(
    private readonly notebooksService: NotebooksService,
    private readonly telemetryService: TelemetryService,
  ) {}

  @Post()
  async create(@Body() dto: CreateNotebookDto) {
    return await this.notebooksService.createNotebook(dto);
  }

  @Get()
  async list() {
    return await this.notebooksService.listNotebooks();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return await this.notebooksService.getNotebook(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updates: Partial<CreateNotebookDto>) {
    return await this.notebooksService.updateNotebook(id, updates);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.notebooksService.deleteNotebook(id);
  }

  @Sse(':id/events')
  streamEvents(@Param('id') id: string): Observable<{ data: string }> {
    return this.telemetryService
      .getNotebookEvents(id)
      .pipe(map((event) => ({ data: JSON.stringify(event) })));
  }
}
