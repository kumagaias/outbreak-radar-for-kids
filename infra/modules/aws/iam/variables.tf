variable "environment" {
  description = "Environment name"
  type        = string
}

variable "lambda_function_name" {
  description = "Lambda function name"
  type        = string
}

variable "dynamodb_cache_table_arn" {
  description = "DynamoDB cache table ARN"
  type        = string
}

variable "dynamodb_shared_cache_table_arn" {
  description = "DynamoDB shared cache table ARN"
  type        = string
}

variable "cloudwatch_log_group_arn" {
  description = "CloudWatch log group ARN"
  type        = string
}

variable "dynamodb_outbreak_table_arn" {
  description = "DynamoDB outbreak data table ARN (optional)"
  type        = string
  default     = ""
}
