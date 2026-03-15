variable "environment" {
  description = "Environment name"
  type        = string
}

variable "identity_pool_name" {
  description = "Cognito Identity Pool name"
  type        = string
}

variable "api_gateway_arn" {
  description = "API Gateway execution ARN"
  type        = string
}

variable "stage" {
  description = "API Gateway stage name (e.g., dev, stag, prod)"
  type        = string
}
