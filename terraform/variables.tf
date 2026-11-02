variable "aws_region" {
  type        = string
  description = "AWS region for Bedrock, Cognito, and S3 resources"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Project name prefix for resource naming"
  default     = "notebooklm"
}

variable "environment" {
  type        = string
  description = "Deployment environment (e.g. dev, staging, prod)"
  default     = "dev"
}

variable "cognito_user_pool_name" {
  type        = string
  description = "Name of the Cognito User Pool"
  default     = "notebooklm-user-pool"
}

variable "enable_bda_staging_bucket" {
  type        = bool
  description = "Whether to provision an S3 staging bucket for Bedrock Data Automation async jobs"
  default     = true
}

variable "create_test_user" {
  type        = bool
  description = "Whether to provision a default seed test user in Cognito"
  default     = true
}

variable "test_user_email" {
  type        = string
  description = "Email address for the seed test user"
  default     = "testuser@notebooklm.local"
}

variable "test_user_password" {
  type        = string
  description = "Permanent password for the seed test user"
  default     = "TestPassword123!"
  sensitive   = true
}

