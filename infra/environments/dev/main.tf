terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "outbreak-radar-terraform-state-dev"
    key    = "dev/terraform.tfstate"
    region = "ap-northeast-1"
  }
}

# Primary provider for Tokyo region (main application resources)
provider "aws" {
  region = "ap-northeast-1"

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "outbreak-radar-for-kids"
      ManagedBy   = "terraform"
    }
  }
}

# Secondary provider for us-east-1 (Bedrock Nova only)
provider "aws" {
  alias  = "virginia"
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "outbreak-radar-for-kids"
      ManagedBy   = "terraform"
    }
  }
}

# SSM Parameter Store for system prompts
module "ssm_prompts" {
  source = "../../modules/aws/ssm-parameter"

  prompt_ja_path    = "/prompts/v1/ja"
  prompt_en_path    = "/prompts/v1/en"
  prompt_ja_content = file("${path.module}/../../modules/aws/ssm-parameter/prompts/ja.txt")
  prompt_en_content = file("${path.module}/../../modules/aws/ssm-parameter/prompts/en.txt")

  tags = {
    Environment = var.environment
    Project     = "outbreak-radar-for-kids"
  }
}

# ECR repository for Lambda container images
module "ecr_lambda" {
  source = "../../modules/aws/ecr"

  environment     = var.environment
  repository_name = "nova-recommendations-${var.environment}"
}

# ECR repository for outbreak fetcher Lambda
module "ecr_outbreak_fetcher" {
  source = "../../modules/aws/ecr"

  environment     = var.environment
  repository_name = "outbreak-data-fetcher-${var.environment}"
}

# Lambda function module
module "lambda" {
  source = "../../modules/aws/lambda"

  environment   = var.environment
  function_name = "nova-recommendations-${var.environment}"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout
  
  # Use container image from ECR (image_uri will be set after docker push)
  image_uri = var.lambda_image_uri != "" ? var.lambda_image_uri : "${module.ecr_lambda.repository_url}:latest"

  environment_variables = {
    DYNAMODB_CACHE_TABLE_NAME        = module.dynamodb_cache.table_name
    DYNAMODB_SHARED_CACHE_TABLE_NAME = module.dynamodb_shared_cache.table_name
    DYNAMODB_OUTBREAK_TABLE_NAME     = module.dynamodb_outbreak_data.table_name
    GUARDRAIL_ID                     = module.bedrock_guardrails.guardrail_id
    GUARDRAIL_VERSION                = "DRAFT"
    ENVIRONMENT                      = var.environment
    PROMPT_JA_PATH                   = module.ssm_prompts.prompt_ja_name
    PROMPT_EN_PATH                   = module.ssm_prompts.prompt_en_name
  }

  iam_role_arn              = module.lambda_iam.role_arn
  api_gateway_execution_arn = module.api_gateway.execution_arn

  # Provisioned Concurrency for morning peak hours (6:00-9:00 JST)
  enable_provisioned_concurrency = var.enable_provisioned_concurrency
  provisioned_concurrency_count  = var.provisioned_concurrency_count
  provisioned_concurrency_min    = var.provisioned_concurrency_min
  provisioned_concurrency_max    = var.provisioned_concurrency_max
  peak_hours_scale_up_cron       = var.peak_hours_scale_up_cron
  peak_hours_scale_down_cron     = var.peak_hours_scale_down_cron
  
  depends_on = [module.ecr_lambda]
}

# IAM role for Lambda
module "lambda_iam" {
  source = "../../modules/aws/iam"

  environment                     = var.environment
  lambda_function_name            = "nova-recommendations-${var.environment}"
  dynamodb_cache_table_arn        = module.dynamodb_cache.table_arn
  dynamodb_shared_cache_table_arn = module.dynamodb_shared_cache.table_arn
  dynamodb_outbreak_table_arn     = module.dynamodb_outbreak_data.table_arn
  cloudwatch_log_group_arn        = module.lambda.log_group_arn
}

# DynamoDB table for client-side caching
module "dynamodb_cache" {
  source = "../../modules/aws/dynamodb"

  environment   = var.environment
  table_name    = "recommendations-cache-${var.environment}"
  hash_key      = "cache_key"
  ttl_enabled   = true
  ttl_attribute = "expiration_time"

  tags = {
    Purpose = "Client-side recommendation cache"
  }
}

# DynamoDB table for server-side shared caching
module "dynamodb_shared_cache" {
  source = "../../modules/aws/dynamodb"

  environment   = var.environment
  table_name    = "shared-recommendations-cache-${var.environment}"
  hash_key      = "cache_key"
  ttl_enabled   = true
  ttl_attribute = "expiration_time"

  tags = {
    Purpose = "Shared AI recommendation cache for cost optimization"
  }
}

# Bedrock Guardrails (us-east-1 only - required for Nova)
module "bedrock_guardrails" {
  source = "../../modules/aws/bedrock-guardrails"

  providers = {
    aws = aws.virginia
  }

  environment = var.environment
  name        = "outbreak-radar-for-kids-pii-filter-${var.environment}"
  description = "Filter PII and sensitive information from Nova requests/responses"
}

# API Gateway
module "api_gateway" {
  source = "../../modules/aws/api-gateway"

  environment               = var.environment
  api_name                  = "nova-recommendations-api-${var.environment}"
  lambda_function_arn       = module.lambda.function_arn
  lambda_function_name      = module.lambda.function_name
  cognito_identity_pool_arn = module.cognito.identity_pool_arn
}

# Cognito Identity Pool
module "cognito" {
  source = "../../modules/aws/cognito"

  environment        = var.environment
  identity_pool_name = "outbreak-radar-for-kids-${var.environment}"
  api_gateway_arn    = module.api_gateway.execution_arn
  stage              = var.environment # dev, stag, or prod
}

# CloudWatch monitoring
module "cloudwatch" {
  source = "../../modules/aws/cloudwatch"

  environment          = var.environment
  lambda_function_name = module.lambda.function_name
  api_gateway_id       = module.api_gateway.api_id
  api_gateway_stage    = module.api_gateway.stage_name
}

# Amplify hosting (Tokyo region)
module "amplify" {
  source = "../../modules/aws/amplify"

  app_name       = "outbreak-radar-for-kids-${var.environment}"
  repository_url = var.github_repository_url
  branch_name    = var.github_branch_name

  # IAM service role
  iam_service_role_arn = var.amplify_service_role_arn

  # Build specification for Expo web
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd mobile
            - npm ci
        build:
          commands:
            - npm run export
      artifacts:
        baseDirectory: mobile/dist
        files:
          - '**/*'
      cache:
        paths:
          - mobile/node_modules/**/*
  EOT

  # Custom rules for SPA routing
  custom_rules = [
    {
      source = "/_expo/<*>"
      target = "/_expo/<*>"
      status = "200"
    },
    {
      source = "/assets/<*>"
      target = "/assets/<*>"
      status = "200"
    },
    {
      source = "/<*>"
      target = "/index.html"
      status = "200"
    }
  ]

  # Custom domain for dev environment
  domain_name            = var.custom_domain_name
  subdomain_prefix       = var.custom_subdomain_prefix
  enable_auto_sub_domain = false

  tags = {
    Environment = var.environment
    Project     = "outbreak-radar-for-kids"
  }
}

# Route 53 DNS records for custom domain
module "route53" {
  source = "../../modules/aws/route53"

  domain_name               = var.custom_domain_name
  subdomain_prefix          = var.custom_subdomain_prefix
  amplify_cloudfront_domain = "d36bphnouivj3t.cloudfront.net"

  # Depends on Amplify domain association
  depends_on = [module.amplify]
}

# DynamoDB table for outbreak data storage
module "dynamodb_outbreak_data" {
  source = "../../modules/aws/dynamodb"

  environment   = var.environment
  table_name    = "outbreak-data-${var.environment}"
  hash_key      = "geographicArea"
  range_key     = "diseaseId"
  ttl_enabled   = true
  ttl_attribute = "expirationTime"

  tags = {
    Purpose = "Outbreak data storage with 10-day TTL"
  }
}

# IAM role for outbreak fetcher Lambda
module "outbreak_fetcher_iam" {
  source = "../../modules/aws/iam"

  environment                     = var.environment
  lambda_function_name            = "outbreak-data-fetcher-${var.environment}"
  dynamodb_cache_table_arn        = module.dynamodb_outbreak_data.table_arn
  dynamodb_shared_cache_table_arn = module.dynamodb_outbreak_data.table_arn # Reuse for simplicity
  cloudwatch_log_group_arn        = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/outbreak-data-fetcher-${var.environment}:*"
}

# Outbreak data fetcher Lambda function
module "outbreak_fetcher_lambda" {
  source = "../../modules/aws/lambda"

  environment   = var.environment
  function_name = "outbreak-data-fetcher-${var.environment}"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  memory_size   = 512
  timeout       = 300 # 5 minutes for API calls
  
  # Use container image from ECR
  image_uri = var.outbreak_fetcher_image_uri != "" ? var.outbreak_fetcher_image_uri : "${module.ecr_outbreak_fetcher.repository_url}:latest"

  environment_variables = {
    DYNAMODB_OUTBREAK_TABLE_NAME = module.dynamodb_outbreak_data.table_name
    ENVIRONMENT                  = var.environment
    TARGET_STATES                = "CA,NY,TX,FL,IL,PA,OH,MI,GA,NC,NJ,VA,WA,MA,AZ,TN,IN,MO,MD,WI,CO,MN,SC,AL,LA,KY,OR,OK,CT,UT,IA,NV,AR,MS,KS,NM,NE,WV,ID,HI,NH,ME,RI,MT,DE,SD,ND,AK,VT,WY"
  }

  iam_role_arn              = module.outbreak_fetcher_iam.role_arn
  api_gateway_execution_arn = "" # Not triggered by API Gateway

  # No Provisioned Concurrency needed for batch processing
  enable_provisioned_concurrency = false
  
  depends_on = [module.ecr_outbreak_fetcher]
}

# EventBridge scheduler for weekly outbreak data fetching
module "outbreak_fetcher_schedule" {
  source = "../../modules/aws/eventbridge"

  rule_name           = "outbreak-data-fetcher-weekly-${var.environment}"
  description         = "Triggers outbreak data fetcher Lambda every Friday at 12:00 UTC (aligned with CDC updates)"
  schedule_expression = "cron(0 12 ? * FRI *)"

  target_lambda_arn           = module.outbreak_fetcher_lambda.function_arn
  target_lambda_function_name = module.outbreak_fetcher_lambda.function_name

  maximum_retry_attempts = 2

  tags = {
    Environment = var.environment
    Purpose     = "outbreak-data-fetching"
  }
}

# GitHub OIDC provider for GitHub Actions
module "github_oidc" {
  source = "../../modules/aws/github-oidc"

  environment        = var.environment
  github_org         = var.github_org
  repository_name    = var.github_repository_name
  ecr_repository_arns = [
    module.ecr_lambda.repository_arn,
    module.ecr_outbreak_fetcher.repository_arn
  ]
  lambda_function_arns = [
    module.lambda.function_arn,
    module.outbreak_fetcher_lambda.function_arn
  ]
}

# Data sources for current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
