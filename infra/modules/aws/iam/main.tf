# IAM role for Lambda function
resource "aws_iam_role" "lambda_role" {
  name = "lambda-${var.lambda_function_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# Policy for Bedrock Nova access (least-privilege)
resource "aws_iam_role_policy" "bedrock_access" {
  name = "bedrock-nova-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = [
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:ApplyGuardrail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Policy for DynamoDB access (cache tables only)
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb-cache-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          var.dynamodb_cache_table_arn,
          var.dynamodb_shared_cache_table_arn
        ]
      }
    ]
  })
}

# Policy for CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "cloudwatch-logs-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${var.cloudwatch_log_group_arn}:*"
      }
    ]
  })
}

# Policy for SSM Parameter Store access (prompts only)
resource "aws_iam_role_policy" "ssm_parameter_access" {
  name = "ssm-parameter-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:*:*:parameter/prompts/v1/*"
        ]
      }
    ]
  })
}

# Policy for Secrets Manager access (e-Stat API key only)
resource "aws_iam_role_policy" "secrets_manager_access" {
  count = var.lambda_function_name == "outbreak-data-fetcher-${var.environment}" ? 1 : 0
  name  = "secrets-manager-access"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:estat-api-key-*"
        ]
      }
    ]
  })
}

# Explicit deny for S3 and other services (defense in depth)
resource "aws_iam_role_policy" "deny_other_services" {
  name = "deny-other-services"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Deny"
        Action = [
          "s3:*",
          "ec2:*",
          "rds:*"
        ]
        Resource = "*"
      }
    ]
  })
}
