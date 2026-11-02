export interface AppConfig {
  nodeEnv: string;
  appMode: 'API' | 'WORKER' | 'ALL';
  port: number;
  aws: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    cognito: {
      userPoolId: string;
      clientId: string;
      region: string;
    };
    bedrock: {
      chatModel: string;
      fastModel: string;
      embeddingModel: string;
      multimodalModel: string;
      embeddingDimensions: number;
      maxChunkTokens: number;
      guardrailId?: string;
      guardrailVersion?: string;
      bdaStagingBucket?: string;
    };
    floci: {
      endpoint: string;
      s3Bucket: string;
      sqsQueueUrl: string;
    };
  };
  database: {
    writeHost: string;
    writePort: number;
    readHosts: string[];
    name: string;
    user: string;
    pass: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  appMode: (process.env.APP_MODE as 'API' | 'WORKER' | 'ALL') || 'ALL',
  port: parseInt(process.env.PORT || '3000', 10),
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId:
      process.env.TERRAFORM_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.TERRAFORM_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID || '',
      clientId: process.env.COGNITO_CLIENT_ID || '',
      region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
    },
    bedrock: {
      chatModel: process.env.BEDROCK_MODEL_CHAT || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      fastModel: process.env.BEDROCK_MODEL_FAST || 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      embeddingModel: process.env.BEDROCK_MODEL_EMBEDDING || 'amazon.titan-embed-text-v2:0',
      multimodalModel: process.env.BEDROCK_MODEL_MULTIMODAL || 'amazon.titan-embed-image-v1',
      embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1024', 10),
      maxChunkTokens: parseInt(process.env.MAX_CHUNK_TOKENS || '1024', 10),
      guardrailId: process.env.BEDROCK_GUARDRAIL_ID,
      guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT',
      bdaStagingBucket: process.env.AWS_BDA_STAGING_BUCKET,
    },
    floci: {
      endpoint: process.env.FLOCI_ENDPOINT || 'http://localhost:4566',
      s3Bucket: process.env.S3_BUCKET_NAME || 'notebooklm-documents',
      sqsQueueUrl:
        process.env.SQS_INGESTION_QUEUE_URL ||
        'http://localhost:4566/000000000000/notebooklm-ingestion-queue',
    },
  },
  database: {
    writeHost: process.env.DB_WRITE_HOST || 'localhost',
    writePort: parseInt(process.env.DB_WRITE_PORT || '5432', 10),
    readHosts: (process.env.DB_READ_HOSTS || process.env.DB_WRITE_HOST || 'localhost')
      .split(',')
      .map((h) => h.trim()),
    name: process.env.DB_NAME || 'notebooklm',
    user: process.env.DB_USER || 'app_user',
    pass: process.env.DB_PASSWORD || 'app_user_secret',
  },
});
