output "identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.this.id
}

output "identity_pool_arn" {
  description = "Cognito Identity Pool ARN"
  value       = aws_cognito_identity_pool.this.arn
}

output "unauthenticated_role_arn" {
  description = "IAM role ARN for unauthenticated users"
  value       = aws_iam_role.unauthenticated.arn
}
