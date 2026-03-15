terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_amplify_app" "main" {
  name = var.app_name

  # Build settings
  build_spec = var.build_spec

  # Environment variables
  environment_variables = var.environment_variables

  # Enable auto branch creation
  enable_auto_branch_creation   = var.enable_auto_branch_creation
  auto_branch_creation_patterns = var.auto_branch_creation_patterns

  # Platform
  platform = var.platform

  # IAM role for Amplify
  iam_service_role_arn = var.iam_service_role_arn

  # Custom rules for SPA routing
  dynamic "custom_rule" {
    for_each = var.custom_rules
    content {
      source = custom_rule.value.source
      target = custom_rule.value.target
      status = custom_rule.value.status
    }
  }

  tags = var.tags

  # Ignore repository changes (managed via AWS Console)
  lifecycle {
    ignore_changes = [repository]
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = var.branch_name

  # Enable auto build
  enable_auto_build = var.enable_auto_build

  # Environment variables (branch-specific)
  environment_variables = var.branch_environment_variables

  tags = var.tags

  # Ignore environment variable changes (managed via AWS Console)
  lifecycle {
    ignore_changes = [environment_variables, framework, stage]
  }
}

resource "aws_amplify_domain_association" "main" {
  count = var.domain_name != null ? 1 : 0

  app_id      = aws_amplify_app.main.id
  domain_name = var.domain_name

  # Enable auto subdomain creation
  enable_auto_sub_domain = var.enable_auto_sub_domain

  # Subdomain settings
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.subdomain_prefix
  }

  # Wait for certificate validation
  wait_for_verification = true
}
