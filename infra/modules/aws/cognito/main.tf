resource "aws_cognito_identity_pool" "this" {
  identity_pool_name               = var.identity_pool_name
  allow_unauthenticated_identities = true
  allow_classic_flow               = false

  tags = {
    Environment = var.environment
  }
}

# IAM role for unauthenticated users
resource "aws_iam_role" "unauthenticated" {
  name = "cognito-unauthenticated-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.this.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "unauthenticated"
          }
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# Policy for unauthenticated users (API Gateway invoke only)
# SECURITY: Restrict to specific endpoint only - /recommendations/generate
resource "aws_iam_role_policy" "unauthenticated" {
  name = "cognito-unauthenticated-policy"
  role = aws_iam_role.unauthenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        # Restrict to POST /recommendations/generate endpoint only
        # Format: arn:aws:execute-api:region:account:api-id/stage/method/path
        Resource = "${var.api_gateway_arn}/${var.stage}/POST/recommendations/generate"
      }
    ]
  })
}

# Attach roles to identity pool
resource "aws_cognito_identity_pool_roles_attachment" "this" {
  identity_pool_id = aws_cognito_identity_pool.this.id

  roles = {
    unauthenticated = aws_iam_role.unauthenticated.arn
  }
}
