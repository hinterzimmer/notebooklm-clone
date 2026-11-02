resource "aws_iam_user" "app_user" {
  name = "${var.project_name}-app-user-${var.environment}"
  path = "/application/"

  tags = {
    Description = "Service account for NotebookLM backend with Bedrock and Cognito access"
  }
}

resource "aws_iam_access_key" "app_user_key" {
  user = aws_iam_user.app_user.name
}

data "aws_iam_policy_document" "app_permissions" {
  # 1. Amazon Bedrock Runtime Permissions
  statement {
    sid    = "BedrockRuntimeAccess"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
      "bedrock:ApplyGuardrail"
    ]
    resources = ["*"]
  }

  # 2. Amazon Bedrock Data Automation Runtime Permissions
  statement {
    sid    = "BedrockDataAutomationAccess"
    effect = "Allow"
    actions = [
      "bedrock:InvokeDataAutomationAsync",
      "bedrock:GetDataAutomationStatus"
    ]
    resources = ["*"]
  }

  # 3. Amazon Cognito Read Permissions
  statement {
    sid    = "CognitoReadAccess"
    effect = "Allow"
    actions = [
      "cognito-idp:GetUser",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient"
    ]
    resources = [aws_cognito_user_pool.pool.arn]
  }

  # 4. S3 Staging Bucket Access for Cloud BDA (if enabled)
  dynamic "statement" {
    for_each = var.enable_bda_staging_bucket ? [1] : []
    content {
      sid    = "S3BdaStagingBucketAccess"
      effect = "Allow"
      actions = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:AbortMultipartUpload"
      ]
      resources = [
        aws_s3_bucket.bda_staging[0].arn,
        "${aws_s3_bucket.bda_staging[0].arn}/*"
      ]
    }
  }
}

resource "aws_iam_policy" "app_policy" {
  name        = "${var.project_name}-app-policy-${var.environment}"
  description = "IAM policy granting Bedrock, Cognito and S3 staging permissions for NotebookLM"
  policy      = data.aws_iam_policy_document.app_permissions.json
}

resource "aws_iam_user_policy_attachment" "app_policy_attach" {
  user       = aws_iam_user.app_user.name
  policy_arn = aws_iam_policy.app_policy.arn
}
