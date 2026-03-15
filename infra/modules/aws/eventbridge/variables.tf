# EventBridge Scheduler Module Variables

variable "rule_name" {
  description = "Name of the EventBridge rule"
  type        = string
}

variable "description" {
  description = "Description of the EventBridge rule"
  type        = string
  default     = "Scheduled event rule"
}

variable "schedule_expression" {
  description = "Schedule expression for the rule (e.g., 'rate(7 days)' or 'cron(0 12 ? * FRI *)')"
  type        = string
  validation {
    condition     = can(regex("^(rate\\(.*\\)|cron\\(.*\\))$", var.schedule_expression))
    error_message = "Schedule expression must be either a rate() or cron() expression"
  }
}

variable "is_enabled" {
  description = "Whether the rule is enabled"
  type        = bool
  default     = true
}

variable "target_lambda_arn" {
  description = "ARN of the Lambda function to invoke"
  type        = string
}

variable "target_lambda_function_name" {
  description = "Name of the Lambda function (for permission resource)"
  type        = string
}

variable "input_transformer" {
  description = "Input transformer configuration for the target"
  type = object({
    input_paths    = map(string)
    input_template = string
  })
  default = null
}

variable "maximum_retry_attempts" {
  description = "Maximum number of retry attempts for failed invocations"
  type        = number
  default     = 2
  validation {
    condition     = var.maximum_retry_attempts >= 0 && var.maximum_retry_attempts <= 185
    error_message = "Maximum retry attempts must be between 0 and 185"
  }
}

variable "dead_letter_queue_arn" {
  description = "ARN of the SQS queue or SNS topic to use as a dead letter queue"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to the EventBridge rule"
  type        = map(string)
  default     = {}
}
