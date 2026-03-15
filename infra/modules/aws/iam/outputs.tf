output "role_arn" {
  description = "IAM role ARN"
  value       = aws_iam_role.lambda_role.arn
}

output "role_name" {
  description = "IAM role name"
  value       = aws_iam_role.lambda_role.name
}
