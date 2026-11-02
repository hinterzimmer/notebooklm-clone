import { Module, Global } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { BedrockService } from './bedrock.service.js';

@Global()
@Module({
  providers: [S3Service, BedrockService],
  exports: [S3Service, BedrockService],
})
export class AwsModule {}
