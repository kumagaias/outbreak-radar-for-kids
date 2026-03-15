variable "environment" {
  description = "Environment name"
  type        = string
}

variable "api_name" {
  description = "API Gateway name"
  type        = string
}

variable "lambda_function_arn" {
  description = "Lambda function ARN"
  type        = string
}

variable "lambda_function_name" {
  description = "Lambda function name"
  type        = string
}

variable "cognito_identity_pool_arn" {
  description = "Cognito Identity Pool ARN"
  type        = string
}
