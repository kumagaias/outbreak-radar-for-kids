variable "environment" {
  description = "Environment name"
  type        = string
}

variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "handler" {
  description = "Lambda function handler"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
}

variable "source_dir" {
  description = "Source directory for Lambda code (used for ZIP deployment)"
  type        = string
  default     = ""
}

variable "image_uri" {
  description = "ECR image URI for container-based Lambda (leave empty for ZIP deployment)"
  type        = string
  default     = ""
}

variable "environment_variables" {
  description = "Environment variables for Lambda"
  type        = map(string)
  default     = {}
}

variable "iam_role_arn" {
  description = "IAM role ARN for Lambda"
  type        = string
}

variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN for Lambda permission"
  type        = string
  default     = ""
}

variable "enable_provisioned_concurrency" {
  description = "Enable Provisioned Concurrency for Lambda function"
  type        = bool
  default     = false
}

variable "provisioned_concurrency_count" {
  description = "Number of provisioned concurrent executions during peak hours"
  type        = number
  default     = 5
}

variable "provisioned_concurrency_min" {
  description = "Minimum provisioned concurrent executions (0 for off-peak hours)"
  type        = number
  default     = 0
}

variable "provisioned_concurrency_max" {
  description = "Maximum provisioned concurrent executions"
  type        = number
  default     = 10
}

variable "peak_hours_scale_up_cron" {
  description = "Cron expression for scaling up during peak hours (6:00 AM JST = 21:00 UTC previous day)"
  type        = string
  default     = "cron(0 21 * * ? *)"
}

variable "peak_hours_scale_down_cron" {
  description = "Cron expression for scaling down after peak hours (9:00 AM JST = 00:00 UTC)"
  type        = string
  default     = "cron(0 0 * * ? *)"
}
