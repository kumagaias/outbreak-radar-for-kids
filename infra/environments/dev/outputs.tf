output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL for mobile app"
  value       = module.api_gateway.invoke_url
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID for mobile app authentication"
  value       = module.cognito.identity_pool_id
}

output "dynamodb_cache_table_name" {
  description = "DynamoDB cache table name"
  value       = module.dynamodb_cache.table_name
}

output "dynamodb_shared_cache_table_name" {
  description = "DynamoDB shared cache table name"
  value       = module.dynamodb_shared_cache.table_name
}

output "guardrail_id" {
  description = "Bedrock Guardrail ID"
  value       = module.bedrock_guardrails.guardrail_id
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = module.lambda.function_name
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL for monitoring"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=${module.cloudwatch.dashboard_name}"
}

output "amplify_app_id" {
  description = "Amplify app ID"
  value       = module.amplify.app_id
}

output "amplify_default_domain" {
  description = "Amplify default domain"
  value       = module.amplify.default_domain
}

output "amplify_branch_url" {
  description = "Amplify branch URL"
  value       = module.amplify.branch_url
}

output "amplify_custom_domain" {
  description = "Amplify custom domain URL (if configured)"
  value       = module.amplify.custom_domain
}

output "route53_hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = module.route53.hosted_zone_id
}

output "route53_subdomain_fqdn" {
  description = "Fully qualified domain name of the custom subdomain"
  value       = module.route53.subdomain_fqdn
}

output "amplify_cloudfront_domain" {
  description = "CloudFront distribution domain for DNS verification"
  value       = module.amplify.cloudfront_domain
}

output "prompt_ja_parameter_name" {
  description = "SSM Parameter Store name for Japanese prompt"
  value       = module.ssm_prompts.prompt_ja_name
}

output "prompt_en_parameter_name" {
  description = "SSM Parameter Store name for English prompt"
  value       = module.ssm_prompts.prompt_en_name
}

output "prompt_ja_version" {
  description = "Version of the Japanese prompt parameter"
  value       = module.ssm_prompts.prompt_ja_version
}

output "prompt_en_version" {
  description = "Version of the English prompt parameter"
  value       = module.ssm_prompts.prompt_en_version
}

output "ecr_lambda_repository_url" {
  description = "ECR repository URL for Lambda container images"
  value       = module.ecr_lambda.repository_url
}

output "ecr_outbreak_fetcher_repository_url" {
  description = "ECR repository URL for outbreak fetcher Lambda container images"
  value       = module.ecr_outbreak_fetcher.repository_url
}
