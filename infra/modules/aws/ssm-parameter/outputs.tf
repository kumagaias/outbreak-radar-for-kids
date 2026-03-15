# Outputs for SSM Parameter Store module

output "prompt_ja_arn" {
  description = "ARN of the Japanese prompt parameter"
  value       = aws_ssm_parameter.prompt_ja.arn
}

output "prompt_en_arn" {
  description = "ARN of the English prompt parameter"
  value       = aws_ssm_parameter.prompt_en.arn
}

output "prompt_ja_name" {
  description = "Name of the Japanese prompt parameter"
  value       = aws_ssm_parameter.prompt_ja.name
}

output "prompt_en_name" {
  description = "Name of the English prompt parameter"
  value       = aws_ssm_parameter.prompt_en.name
}

output "prompt_ja_version" {
  description = "Version of the Japanese prompt parameter"
  value       = aws_ssm_parameter.prompt_ja.version
}

output "prompt_en_version" {
  description = "Version of the English prompt parameter"
  value       = aws_ssm_parameter.prompt_en.version
}
