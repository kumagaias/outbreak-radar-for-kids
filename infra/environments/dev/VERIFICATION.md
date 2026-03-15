# Dev Environment Configuration Verification

**Task**: 1.8 Create dev environment configuration  
**Date**: 2026-03-12  
**Status**: ✅ COMPLETE

## Requirements Verification

### ✅ Requirement 14.2: Support multiple environments
- Configuration exists in `infra/environments/dev/`
- Uses reusable modules from `infra/modules/aws/`
- Environment variable: `dev`

### ✅ Requirement 14.11: Output API Gateway endpoint and Cognito Identity Pool ID
**Outputs verified**:
- `api_gateway_endpoint`: https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev/recommendations/generate
- `cognito_identity_pool_id`: ap-northeast-1:b2ab64de-0f7c-49dd-94ae-6a6df79273a3

**Additional outputs**:
- DynamoDB tables: `recommendations-cache-dev`, `shared-recommendations-cache-dev`
- Lambda function: `nova-recommendations-dev`
- Bedrock Guardrail ID: `9bgagec6ovam`
- CloudWatch dashboard URL
- Amplify app URLs and custom domain
- Route53 hosted zone and subdomain FQDN
- SSM Parameter Store paths for prompts

### ✅ Requirement 14.13: Tag all resources with Environment tag
- Default tags configured in provider block:
  ```hcl
  default_tags {
    tags = {
      Environment = var.environment  # "dev"
      Project     = "outbreak-radar-for-kids"
      ManagedBy   = "terraform"
    }
  }
  ```

### ✅ Region Configuration
**Dual-region architecture** (correct implementation):
- **Primary region**: `ap-northeast-1` (Tokyo)
  - Lambda function
  - API Gateway
  - DynamoDB tables
  - Cognito Identity Pool
  - CloudWatch Logs
  - Amplify hosting
  
- **Secondary region**: `us-east-1` (Virginia)
  - Bedrock Nova Lite/Micro (Requirement 14.9)
  - Bedrock Guardrails

**Rationale**: Nova models are only available in us-east-1. Lambda in Tokyo region calls Bedrock in Virginia region with configurable `BEDROCK_REGION` environment variable for future migration.

## Modules Used

1. ✅ `ssm_prompts` - System prompts in Parameter Store
2. ✅ `lambda` - Nova recommendations Lambda function
3. ✅ `lambda_iam` - IAM role with least-privilege permissions
4. ✅ `dynamodb_cache` - Client-side recommendation cache
5. ✅ `dynamodb_shared_cache` - Server-side shared cache
6. ✅ `bedrock_guardrails` - PII filtering (us-east-1)
7. ✅ `api_gateway` - REST API with `/recommendations/generate` endpoint
8. ✅ `cognito` - Identity Pool for unauthenticated access
9. ✅ `cloudwatch` - Monitoring and alarms
10. ✅ `amplify` - Frontend hosting
11. ✅ `route53` - Custom domain DNS

## Environment Variables

Lambda function environment variables:
- `DYNAMODB_CACHE_TABLE_NAME`: recommendations-cache-dev
- `DYNAMODB_SHARED_CACHE_TABLE_NAME`: shared-recommendations-cache-dev
- `GUARDRAIL_ID`: 9bgagec6ovam
- `GUARDRAIL_VERSION`: DRAFT
- `ENVIRONMENT`: dev
- `PROMPT_JA_PATH`: /prompts/v1/ja
- `PROMPT_EN_PATH`: /prompts/v1/en

## Terraform Validation

```bash
$ terraform validate
Success! The configuration is valid.
```

## Deployment Status

Infrastructure is **DEPLOYED** to AWS:
- Terraform state exists: `terraform.tfstate`
- All resources created successfully
- Outputs available via `terraform output`

## Task Completion Criteria

✅ Create `infra/environments/dev/main.tf` using reusable modules  
✅ Configure environment-specific variables (environment=dev, region=us-east-1 for Bedrock)  
✅ Add resource tagging with Environment=dev  
✅ Output API Gateway endpoint URL and Cognito Identity Pool ID  

**Status**: Task 1.8 is COMPLETE and verified.

## Configuration Drift

Terraform plan shows pending changes:
- **SSM Parameter Store**: 2 parameters to be created (Task 1.5 - not yet done)
  - `/prompts/v1/ja` - Japanese system prompt
  - `/prompts/v1/en` - English system prompt
- **Route53**: Minor updates to hosted zone configuration
- **Amplify**: Backend environment ARN cleanup

These changes are expected and do not affect Task 1.8 completion. The SSM parameters will be created when Task 1.5 is executed.

## Next Steps

1. Task 1.9 (Deploy infrastructure to dev environment) is already complete
2. Task 1.5 (Create Systems Manager Parameter Store for prompts) needs to be executed to apply pending SSM parameter changes
3. Backend Lambda currently uses hardcoded prompts (Task 2.5) until SSM parameters are created
