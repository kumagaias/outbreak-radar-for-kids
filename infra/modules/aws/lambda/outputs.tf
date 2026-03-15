output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.this.arn
}

output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.this.function_name
}

output "invoke_arn" {
  description = "Lambda function invoke ARN"
  value       = aws_lambda_function.this.invoke_arn
}

output "log_group_arn" {
  description = "CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.lambda_logs.arn
}

output "alias_arn" {
  description = "Lambda alias ARN"
  value       = aws_lambda_alias.live.arn
}

output "alias_name" {
  description = "Lambda alias name"
  value       = aws_lambda_alias.live.name
}
