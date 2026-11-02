#!/usr/bin/env bash
set -e

echo "Waiting for Floci to be available on port 4566..."
until curl -s http://localhost:4566/_floci/health > /dev/null 2>&1 || curl -s http://localhost:4566 > /dev/null 2>&1; do
  sleep 1
done

echo "Configuring Floci AWS resources..."
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
ENDPOINT="http://localhost:4566"

# Create S3 Bucket
aws --endpoint-url=$ENDPOINT s3 mb s3://notebooklm-documents || true

# Create SQS Queue
aws --endpoint-url=$ENDPOINT sqs create-queue --queue-name notebooklm-ingestion-queue || true

echo "Floci initialization complete!"
