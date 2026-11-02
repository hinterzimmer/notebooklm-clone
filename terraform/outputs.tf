output "aws_region" {
  description = "Configured AWS Region"
  value       = var.aws_region
}

output "aws_access_key_id" {
  description = "IAM User Access Key ID (Client ID)"
  value       = aws_iam_access_key.app_user_key.id
}

output "aws_secret_access_key" {
  description = "IAM User Secret Access Key"
  value       = aws_iam_access_key.app_user_key.secret
  sensitive   = true
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  description = "Cognito App Client ID (Public SPA Client)"
  value       = aws_cognito_user_pool_client.client.id
}

output "bda_staging_bucket_name" {
  description = "Bedrock Data Automation S3 staging bucket name"
  value       = var.enable_bda_staging_bucket ? aws_s3_bucket.bda_staging[0].bucket : ""
}

output "test_user_email" {
  description = "Email of the provisioned test user"
  value       = var.create_test_user ? var.test_user_email : ""
}

output "test_user_password" {
  description = "Password of the provisioned test user"
  value       = var.create_test_user ? var.test_user_password : ""
  sensitive   = true
}

output "docker_env_snippet" {
  description = "Formatted environment variables for .env or docker-compose"
  value       = <<EOT
# AWS Credentials & Region (from Terraform)
AWS_REGION=${var.aws_region}
AWS_ACCESS_KEY_ID=${aws_iam_access_key.app_user_key.id}
AWS_SECRET_ACCESS_KEY=${aws_iam_access_key.app_user_key.secret}

# Amazon Cognito (from Terraform)
COGNITO_USER_POOL_ID=${aws_cognito_user_pool.pool.id}
COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.client.id}
COGNITO_REGION=${var.aws_region}

# Seed Test User (from Terraform)
TEST_USER_EMAIL=${var.create_test_user ? var.test_user_email : ""}
TEST_USER_PASSWORD=${var.create_test_user ? var.test_user_password : ""}

# Bedrock Data Automation Staging Bucket (from Terraform)
AWS_BDA_STAGING_BUCKET=${var.enable_bda_staging_bucket ? aws_s3_bucket.bda_staging[0].bucket : ""}
EOT
  sensitive   = true
}
