import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand,
  ApplyGuardrailCommand,
  Message as BedrockMessage,
  ContentBlock,
} from '@aws-sdk/client-bedrock-runtime';


@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  public readonly runtimeClient: BedrockRuntimeClient;

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('aws');

    const clientConfig: any = {
      region: awsConfig.region,
    };
    if (awsConfig.accessKeyId) {
      const credentials: any = {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey || '',
      };
      // Only attach session token if we're using temporary STS credentials (starts with ASIA)
      if (awsConfig.sessionToken && awsConfig.accessKeyId.startsWith('ASIA')) {
        credentials.sessionToken = awsConfig.sessionToken;
      }
      clientConfig.credentials = credentials;
    }

    this.runtimeClient = new BedrockRuntimeClient(clientConfig);
  }

  /**
   * Generates a 1024-dimensional text embedding using Titan Text v2
   */
  async generateTextEmbedding(text: string): Promise<number[]> {
    const awsConfig = this.configService.get('aws');
    const modelId = awsConfig.bedrock.embeddingModel;
    const dimensions = awsConfig.bedrock.embeddingDimensions; // 1024

    const payload = {
      inputText: text,
      dimensions: dimensions,
      normalize: true,
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: Buffer.from(JSON.stringify(payload)),
    });

    const res = await this.runtimeClient.send(command);
    const bodyStr = Buffer.from(res.body).toString('utf-8');
    const result = JSON.parse(bodyStr);

    return result.embedding as number[];
  }

  /**
   * Generates a 1024-dimensional multimodal embedding from image bytes using Titan Multimodal G1
   */
  async generateImageEmbedding(imageBytesBase64: string): Promise<number[]> {
    const awsConfig = this.configService.get('aws');
    const modelId = awsConfig.bedrock.multimodalModel;

    const payload = {
      inputImage: imageBytesBase64,
      embeddingConfig: {
        outputEmbeddingLength: 1024,
      },
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: Buffer.from(JSON.stringify(payload)),
    });

    const res = await this.runtimeClient.send(command);
    const bodyStr = Buffer.from(res.body).toString('utf-8');
    const result = JSON.parse(bodyStr);

    return result.embedding as number[];
  }

  /**
   * Direct document Converse call (fallback for small files when cloud BDA staging bucket is not configured)
   */
  async converseWithDocument(
    documentBytes: Buffer,
    format: 'pdf' | 'png' | 'jpeg' | 'txt' | 'md',
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const awsConfig = this.configService.get('aws');
    const modelId = awsConfig.bedrock.chatModel;

    const command = new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: 'user',
          content: [
            {
              document: {
                name: 'document',
                format: format === 'md' ? 'txt' : (format as any),
                source: { bytes: documentBytes },
              },
            },
            { text: userPrompt },
          ],
        },
      ],
    });

    const response = await this.runtimeClient.send(command);
    const outputBlock = response.output?.message?.content?.[0];
    return outputBlock && 'text' in outputBlock ? outputBlock.text || '' : '';
  }

  /**
   * Evaluates text against configured Bedrock Guardrails
   */
  async applyGuardrail(
    text: string,
    source: 'INPUT' | 'OUTPUT' = 'INPUT',
  ): Promise<{ action: 'NONE' | 'GUARDRAIL_INTERVENED'; outputs?: string[] }> {
    const awsConfig = this.configService.get('aws');
    const guardrailId = awsConfig.bedrock.guardrailId;
    const guardrailVersion = awsConfig.bedrock.guardrailVersion;

    if (!guardrailId) {
      return { action: 'NONE' };
    }

    try {
      const command = new ApplyGuardrailCommand({
        guardrailIdentifier: guardrailId,
        guardrailVersion: guardrailVersion,
        source,
        content: [{ text: { text } }],
      });

      const res = await this.runtimeClient.send(command);
      if (res.action === 'GUARDRAIL_INTERVENED') {
        const texts = res.outputs?.map((o) => o.text).filter(Boolean) as string[];
        return { action: 'GUARDRAIL_INTERVENED', outputs: texts };
      }
      return { action: 'NONE' };
    } catch (err) {
      this.logger.error('Error checking Bedrock Guardrail', err);
      return { action: 'NONE' };
    }
  }
}
