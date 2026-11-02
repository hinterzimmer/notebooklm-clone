import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  public readonly s3Client: S3Client;
  public readonly defaultBucket: string;

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    this.defaultBucket = awsConfig.floci.s3Bucket;

    // Use Floci endpoint for local dev if configured, otherwise standard AWS
    this.s3Client = new S3Client({
      region: awsConfig.region,
      endpoint: awsConfig.floci.endpoint,
      forcePathStyle: true,
      credentials: awsConfig.accessKeyId
        ? {
            accessKeyId: awsConfig.accessKeyId,
            secretAccessKey: awsConfig.secretAccessKey || '',
          }
        : {
            accessKeyId: 'test',
            secretAccessKey: 'test',
          },
    });
  }

  async onModuleInit() {
    try {
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: this.defaultBucket,
        }),
      );
      this.logger.log(`Initialized S3 bucket: ${this.defaultBucket}`);
    } catch (err: any) {
      if (
        err.name === 'BucketAlreadyOwnedByYou' ||
        err.name === 'BucketAlreadyExists' ||
        err.Code === 'BucketAlreadyOwnedByYou' ||
        err.Code === 'BucketAlreadyExists'
      ) {
        // bucket already exists
      } else {
        this.logger.debug?.(`S3 bucket check: ${err.message}`);
      }
    }
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
    bucket = this.defaultBucket,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async uploadText(
    key: string,
    text: string,
    contentType = 'text/markdown',
    bucket = this.defaultBucket,
  ): Promise<void> {
    await this.uploadBuffer(key, Buffer.from(text, 'utf-8'), contentType, bucket);
  }

  async getObjectBuffer(key: string, bucket = this.defaultBucket): Promise<Buffer> {
    const res = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    const stream = res.Body as any;
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getObjectText(key: string, bucket = this.defaultBucket): Promise<string> {
    const buffer = await this.getObjectBuffer(key, bucket);
    return buffer.toString('utf-8');
  }

  async getPresignedUrl(key: string, expiresIn = 3600, bucket = this.defaultBucket): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async objectExists(key: string, bucket = this.defaultBucket): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
