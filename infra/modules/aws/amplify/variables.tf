variable "app_name" {
  description = "Name of the Amplify application"
  type        = string
}

variable "repository_url" {
  description = "GitHub repository URL (e.g., https://github.com/username/repo)"
  type        = string
}

variable "branch_name" {
  description = "Git branch name to deploy"
  type        = string
  default     = "main"
}

variable "platform" {
  description = "Platform for the Amplify app (WEB or WEB_COMPUTE)"
  type        = string
  default     = "WEB"
}

variable "build_spec" {
  description = "Build specification (build commands, artifacts, etc.)"
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Environment variables for the Amplify app"
  type        = map(string)
  default     = {}
}

variable "branch_environment_variables" {
  description = "Branch-specific environment variables"
  type        = map(string)
  default     = {}
}

variable "enable_auto_branch_creation" {
  description = "Enable automatic branch creation"
  type        = bool
  default     = false
}

variable "auto_branch_creation_patterns" {
  description = "Patterns for automatic branch creation"
  type        = list(string)
  default     = []
}

variable "enable_auto_build" {
  description = "Enable automatic builds on push"
  type        = bool
  default     = true
}

variable "iam_service_role_arn" {
  description = "IAM service role ARN for Amplify"
  type        = string
  default     = null
}

variable "custom_rules" {
  description = "Custom rewrite and redirect rules"
  type = list(object({
    source = string
    target = string
    status = string
  }))
  default = []
}

variable "domain_name" {
  description = "Custom domain name (e.g., example.com)"
  type        = string
  default     = null
}

variable "subdomain_prefix" {
  description = "Subdomain prefix (e.g., 'app' for app.example.com)"
  type        = string
  default     = ""
}

variable "enable_auto_sub_domain" {
  description = "Enable automatic subdomain creation for branches"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
