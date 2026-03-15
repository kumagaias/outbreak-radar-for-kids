variable "environment" {
  description = "Environment name (dev, stag, prod)"
  type        = string
  default     = "dev"
}

variable "lambda_memory_size" {
  description = "Lambda function memory allocation in MB"
  type        = number
  default     = 512

  validation {
    condition     = var.lambda_memory_size >= 512 && var.lambda_memory_size <= 1024
    error_message = "Lambda memory must be between 512MB and 1024MB for cost/performance balance."
  }
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30

  validation {
    condition     = var.lambda_timeout >= 10 && var.lambda_timeout <= 30
    error_message = "Lambda timeout must be between 10-30 seconds (accommodates Bedrock Guardrails latency + network latency from Japan)."
  }
}

variable "github_repository_url" {
  description = "GitHub repository URL for Amplify"
  type        = string
  default     = "https://github.com/kumagaias/outbreak-radar-for-kids"
}

variable "github_branch_name" {
  description = "GitHub branch name to deploy"
  type        = string
  default     = "main"
}

variable "custom_domain_name" {
  description = "Custom domain name (e.g., kumagaias.com)"
  type        = string
  default     = "kumagaias.com"
}

variable "custom_subdomain_prefix" {
  description = "Subdomain prefix (e.g., 'outbreak-radar-for-kids')"
  type        = string
  default     = "outbreak-radar-for-kids"
}

variable "amplify_service_role_arn" {
  description = "IAM service role ARN for Amplify"
  type        = string
  default     = "arn:aws:iam::843925270284:role/outbreak-radar-for-kids-dev-amplify-backend-role"
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

variable "lambda_image_uri" {
  description = "ECR image URI for Lambda function (leave empty to use latest from ECR)"
  type        = string
  default     = ""
}

variable "outbreak_fetcher_image_uri" {
  description = "ECR image URI for outbreak fetcher Lambda (leave empty to use latest from ECR)"
  type        = string
  default     = ""
}

variable "github_org" {
  description = "GitHub organization or username"
  type        = string
  default     = "kumagaias"
}

variable "github_repository_name" {
  description = "GitHub repository name"
  type        = string
  default     = "outbreak-radar-for-kids"
}
