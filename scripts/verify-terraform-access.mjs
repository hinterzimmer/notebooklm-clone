#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('=====================================================');
console.log(' NotebookLM AWS Terraform Credentials Verifier');
console.log('=====================================================\n');

// 1. Load credentials from terraform output or .env
let accessKeyId = '';
let secretAccessKey = '';
let region = 'us-east-1';
let userPoolId = '';
let clientId = '';

try {
  const tfOutputRaw = execSync('terraform -chdir=terraform output -json', {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  const tfOutput = JSON.parse(tfOutputRaw);
  accessKeyId = tfOutput.aws_access_key_id?.value;
  secretAccessKey = tfOutput.aws_secret_access_key?.value;
  region = tfOutput.aws_region?.value || 'us-east-1';
  userPoolId = tfOutput.cognito_user_pool_id?.value;
  clientId = tfOutput.cognito_client_id?.value;
  console.log('Loaded credentials directly from Terraform outputs:');
} catch (e) {
  console.log('Could not read from terraform CLI, reading from .env file:');
  const envPath = resolve(rootDir, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (key === 'AWS_ACCESS_KEY_ID') accessKeyId = val;
        if (key === 'AWS_SECRET_ACCESS_KEY') secretAccessKey = val;
        if (key === 'AWS_REGION') region = val;
        if (key === 'COGNITO_USER_POOL_ID') userPoolId = val;
        if (key === 'COGNITO_CLIENT_ID') clientId = val;
      }
    }
  }
}

console.log(`- AWS Region:         ${region}`);
console.log(`- AWS Access Key ID:  ${accessKeyId}`);
console.log(`- AWS Secret Key:     ${secretAccessKey ? '***' + secretAccessKey.slice(-4) : '(empty)'}`);
console.log(`- Cognito User Pool:  ${userPoolId || '(none)'}`);
console.log(`- Cognito Client ID:  ${clientId || '(none)'}\n`);

if (!accessKeyId || !secretAccessKey) {
  console.error('ERROR: No valid AWS credentials found in Terraform outputs or .env');
  process.exit(1);
}

// Clean execution environment: explicitly unset AWS_SESSION_TOKEN so expired host SSO sessions never leak
const cleanEnv = {
  ...process.env,
  AWS_ACCESS_KEY_ID: accessKeyId,
  AWS_SECRET_ACCESS_KEY: secretAccessKey,
  AWS_REGION: region,
  AWS_SESSION_TOKEN: '',
  AWS_SECURITY_TOKEN: '',
};
delete cleanEnv.AWS_SESSION_TOKEN;
delete cleanEnv.AWS_SECURITY_TOKEN;

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  process.stdout.write(`[Test ${testsTotal}] ${name} ... `);
  try {
    const result = fn();
    console.log(' PASSED');
    if (result) {
      console.log(`           ${result}`);
    }
    testsPassed++;
  } catch (err) {
    console.log(' FAILED');
    console.error(`           Error: ${err.message || err}`);
  }
}

// Test 1: STS Caller Identity
runTest('Verify IAM User Identity (sts:GetCallerIdentity)', () => {
  const out = execSync('aws sts get-caller-identity --output json', {
    env: cleanEnv,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const data = JSON.parse(out);
  return `Identity ARN: ${data.Arn} (Account: ${data.Account})`;
});

// Test 2: Bedrock Titan Text Embeddings v2
runTest('Verify Amazon Bedrock Titan Text Embeddings (InvokeModel)', () => {
  const out = execSync(
    'aws bedrock-runtime invoke-model --model-id amazon.titan-embed-text-v2:0 --body \'{"inputText":"NotebookLM test embedding"}\' --cli-binary-format raw-in-base64-out /tmp/test_embed.json --output json',
    {
      env: cleanEnv,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const fileContent = readFileSync('/tmp/test_embed.json', 'utf-8');
  const parsed = JSON.parse(fileContent);
  const dim = parsed.embedding ? parsed.embedding.length : 'unknown';
  return `Successfully generated Titan v2 embedding vector (dimension: ${dim})`;
});

// Test 3: Bedrock Claude Converse (Chat Generation)
runTest('Verify Amazon Bedrock Claude Sonnet (Converse API)', () => {
  const modelId = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
  const out = execSync(
    `aws bedrock-runtime converse --model-id ${modelId} --messages '[{"role":"user","content":[{"text":"Respond with only the word OK"}]}]' --output json`,
    {
      env: cleanEnv,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const parsed = JSON.parse(out);
  const text = parsed?.output?.message?.content?.[0]?.text?.trim() || '';
  return `Claude Sonnet Response: "${text}" (latency: ${parsed?.metrics?.latencyMs}ms)`;
});

// Test 4: Bedrock Fast Model (Haiku Converse)
runTest('Verify Amazon Bedrock Claude Haiku (Fast Converse API)', () => {
  const modelId = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
  const out = execSync(
    `aws bedrock-runtime converse --model-id ${modelId} --messages '[{"role":"user","content":[{"text":"Respond with only the word FAST"}]}]' --output json`,
    {
      env: cleanEnv,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  const parsed = JSON.parse(out);
  const text = parsed?.output?.message?.content?.[0]?.text?.trim() || '';
  return `Claude Haiku Response: "${text}" (latency: ${parsed?.metrics?.latencyMs}ms)`;
});

// Test 5: Amazon Cognito Read Access
if (userPoolId) {
  runTest('Verify Amazon Cognito User Pool Access (DescribeUserPool)', () => {
    const out = execSync(
      `aws cognito-idp describe-user-pool --user-pool-id ${userPoolId} --output json`,
      {
        env: cleanEnv,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const parsed = JSON.parse(out);
    return `User Pool Name: ${parsed?.UserPool?.Name} (Status: Active)`;
  });
}

console.log('\n=====================================================');
console.log(` Summary: ${testsPassed}/${testsTotal} verification tests passed`);
console.log('=====================================================\n');

if (testsPassed === testsTotal) {
  console.log('SUCCESS: All credentials created by Terraform are valid and functioning.\n');
  process.exit(0);
} else {
  console.error('FAILURE: One or more credential verification tests failed.\n');
  process.exit(1);
}
