terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_bedrock_guardrail" "this" {
  name        = var.name
  description = var.description

  # Content policy for PII filtering
  content_policy_config {
    filters_config {
      type            = "SEXUAL"
      input_strength  = "HIGH"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "VIOLENCE"
      input_strength  = "HIGH"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "HATE"
      input_strength  = "HIGH"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "INSULTS"
      input_strength  = "HIGH"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "MISCONDUCT"
      input_strength  = "HIGH"
      output_strength = "MEDIUM"
    }
    filters_config {
      type            = "PROMPT_ATTACK"
      input_strength  = "HIGH"
      output_strength = "NONE"
    }
  }

  # Sensitive information policy
  sensitive_information_policy_config {
    pii_entities_config {
      type   = "NAME"
      action = "BLOCK"
    }
    pii_entities_config {
      type   = "ADDRESS"
      action = "BLOCK"
    }
    pii_entities_config {
      type   = "AGE"
      action = "BLOCK"
    }
    pii_entities_config {
      type   = "EMAIL"
      action = "BLOCK"
    }
    pii_entities_config {
      type   = "PHONE"
      action = "BLOCK"
    }
  }

  # Topic policy to block medical diagnosis
  topic_policy_config {
    topics_config {
      name       = "medical_diagnosis"
      definition = "Medical diagnosis or treatment recommendations"
      examples = [
        "Your child has influenza",
        "You should give this medication",
        "This is a symptom of COVID-19",
        "Your child is diagnosed with",
        "Treatment for this condition"
      ]
      type = "DENY"
    }
  }

  blocked_input_messaging   = "Input contains sensitive information that cannot be processed."
  blocked_outputs_messaging = "Response contains sensitive information and has been blocked."

  tags = {
    Environment = var.environment
  }
}
