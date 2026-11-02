import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CognitoAuthGuard } from '../../auth/cognito.guard.js';
import { SourcesService } from './sources.service.js';

@Controller()
@UseGuards(CognitoAuthGuard)
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Post('notebooks/:id/sources')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSource(
    @Param('id') notebookId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return await this.sourcesService.uploadSource(notebookId, file);
  }

  @Get('notebooks/:id/sources')
  async listSources(@Param('id') notebookId: string) {
    return await this.sourcesService.listSources(notebookId);
  }

  @Get('sources/:id/versions')
  async listVersions(@Param('id') sourceId: string) {
    return await this.sourcesService.listVersions(sourceId);
  }
}
