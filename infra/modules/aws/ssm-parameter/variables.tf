# Variables for SSM Parameter Store module

variable "prompt_ja_path" {
  description = "Parameter Store path for Japanese prompt"
  type        = string
  default     = "/prompts/v1/ja"
}

variable "prompt_en_path" {
  description = "Parameter Store path for English prompt"
  type        = string
  default     = "/prompts/v1/en"
}

variable "prompt_ja_content" {
  description = "Japanese system prompt content"
  type        = string
}

variable "prompt_en_content" {
  description = "English system prompt content"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
