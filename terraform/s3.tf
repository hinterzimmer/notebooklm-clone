resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "bda_staging" {
  count         = var.enable_bda_staging_bucket ? 1 : 0
  bucket        = "${var.project_name}-bda-staging-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_lifecycle_configuration" "bda_staging_lifecycle" {
  count  = var.enable_bda_staging_bucket ? 1 : 0
  bucket = aws_s3_bucket.bda_staging[0].id

  rule {
    id     = "expire-after-24-hours"
    status = "Enabled"

    filter {}

    expiration {
      days = 1
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

resource "aws_s3_bucket_public_access_block" "bda_staging_block" {
  count  = var.enable_bda_staging_bucket ? 1 : 0
  bucket = aws_s3_bucket.bda_staging[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
