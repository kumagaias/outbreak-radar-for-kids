# Systems Manager Parameter Store for Nova AI System Prompts
# Stores versioned prompts for Japanese and English recommendations

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Japanese system prompt (v1)
resource "aws_ssm_parameter" "prompt_ja" {
  name        = var.prompt_ja_path
  description = "Japanese system prompt for Nova AI recommendations (v1)"
  type        = "String"
  value       = var.prompt_ja_content
  tier        = "Standard"

  tags = merge(
    var.tags,
    {
      Name     = "nova-prompt-ja-v1"
      Language = "ja"
      Version  = "v1"
      Purpose  = "AI system prompt"
    }
  )
}

# English system prompt (v1)
resource "aws_ssm_parameter" "prompt_en" {
  name        = var.prompt_en_path
  description = "English system prompt for Nova AI recommendations (v1)"
  type        = "String"
  value       = var.prompt_en_content
  tier        = "Standard"

  tags = merge(
    var.tags,
    {
      Name     = "nova-prompt-en-v1"
      Language = "en"
      Version  = "v1"
      Purpose  = "AI system prompt"
    }
  )
}
