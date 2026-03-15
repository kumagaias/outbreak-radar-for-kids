# Infrastructure

Terraform infrastructure for Nova AI Recommendations backend.

## Structure

```
infra/
├── environments/          # Environment-specific configurations
│   ├── dev/              # Development environment
│   ├── stag/             # Staging environment (future)
│   └── prod/             # Production environment (future)
└── modules/              # Reusable Terraform modules
    └── aws/              # AWS-specific modules
        ├── lambda/       # Lambda function
        ├── iam/          # IAM roles and policies
        ├── dynamodb/     # DynamoDB tables
        ├── bedrock-guardrails/  # Bedrock Guardrails
        ├── api-gateway/  # API Gateway REST API
        ├── cognito/      # Cognito Identity Pool
        └── cloudwatch/   # CloudWatch monitoring
```

## Prerequisites

1. Install Terraform:
```bash
mise use terraform@latest
mise install
```

2. Configure AWS credentials:
```bash
aws configure
```

3. Ensure Bedrock model access is enabled in us-east-1:
   - Nova Lite (amazon.nova-lite-v1:0)
   - Nova Micro (amazon.nova-micro-v1:0)
   - See [Bedrock Model Access Setup](docs/bedrock-model-access.md) for detailed instructions
   - Run `./scripts/check-bedrock-access.sh` to verify access

## Deployment

### Dev Environment

```bash
cd infra/environments/dev
terraform init
terraform plan
terraform apply
```

### Outputs

After deployment, Terraform outputs:
- `api_gateway_endpoint` - API endpoint URL for mobile app
- `cognito_identity_pool_id` - Cognito Identity Pool ID for authentication
- `dynamodb_cache_table_name` - DynamoDB cache table name
- `dynamodb_shared_cache_table_name` - DynamoDB shared cache table name
- `guardrail_id` - Bedrock Guardrail ID
- `lambda_function_name` - Lambda function name
- `cloudwatch_dashboard_url` - CloudWatch dashboard URL

### Update Mobile App Configuration

After deployment, update mobile app with outputs:

```typescript
// mobile/lib/aws-config.ts
export const awsConfig = {
  apiEndpoint: '<api_gateway_endpoint>',
  cognitoIdentityPoolId: '<cognito_identity_pool_id>',
  region: 'us-east-1'
};
```

## Resources Created

### Lambda Function
- Runtime: Node.js 20.x
- Memory: 512MB-1024MB
- Timeout: 10 seconds
- Environment variables: DynamoDB tables, Guardrail ID

### IAM Role (Least-Privilege)
- Bedrock Nova Lite/Micro invocation (us-east-1 only)
- DynamoDB read/write (cache tables only)
- CloudWatch Logs write
- Explicit deny for S3, EC2, RDS, Secrets Manager

### DynamoDB Tables
- `recommendations-cache-{env}` - Client-side cache
- `shared-recommendations-cache-{env}` - Server-side shared cache
- Billing: On-demand
- TTL: Enabled (24 hours for client cache, 1 hour for shared cache)

### Bedrock Guardrails
- PII filtering (NAME, ADDRESS, AGE, EMAIL, PHONE blocked)
- Content policy (HIGH input strength, MEDIUM output strength)
- Topic policy (medical diagnosis blocked)

### API Gateway
- REST API with `/recommendations/generate` endpoint
- IAM authentication (AWS Signature Version 4)
- Rate limiting: 10 requests per 15 minutes per Identity ID
- CloudWatch logging enabled
- HTTPS only

### Cognito Identity Pool
- Unauthenticated access enabled
- IAM role with API Gateway invoke permission only

### CloudWatch Monitoring
- Lambda error alarm (threshold: 5% error rate)
- Lambda duration alarm (threshold: 4 seconds)
- Dashboard with Lambda metrics, API Gateway metrics, cache hit rate, Nova API calls

## Cost Estimates

### Dev Environment (100 requests/day, 80% cache hit rate)

- **Nova API calls**: ~$0.60/month (20 requests/day × 30 days × $0.001)
- **Lambda**: ~$0.20/month (100 invocations/day × 512MB × 2s avg)
- **DynamoDB**: ~$0.10/month (on-demand, low usage)
- **API Gateway**: ~$0.01/month (100 requests/day)
- **CloudWatch Logs**: ~$0.05/month (7-day retention)

**Total**: ~$1/month

### Production Estimates (1000 requests/day, 80% cache hit rate)

- **Nova API calls**: ~$6/month
- **Lambda**: ~$2/month
- **DynamoDB**: ~$1/month
- **API Gateway**: ~$0.10/month
- **CloudWatch Logs**: ~$0.50/month

**Total**: ~$10/month

## Monitoring

### CloudWatch Dashboard

Access dashboard: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=nova-recommendations-dev`

Metrics:
- Lambda invocations, errors, duration
- API Gateway requests, 4XX/5XX errors
- Cache hit rate
- Nova API call count

### Alarms

- Lambda errors > 5% → Investigate error logs
- Lambda duration > 4s → Check Nova API latency or optimize code

## Troubleshooting

### Bedrock Model Access

If deployment fails with "Model not found":
1. Go to AWS Console → Bedrock → Model access
2. Enable Nova Lite and Nova Micro in us-east-1
3. Wait 5-10 minutes for access to be granted
4. Re-run `terraform apply`

### Lambda Permission Errors

If API Gateway returns 500 errors:
1. Check Lambda execution role has correct permissions
2. Verify API Gateway has permission to invoke Lambda
3. Check CloudWatch Logs: `/aws/lambda/nova-recommendations-dev`

### Rate Limiting

If mobile app receives 429 errors:
- Rate limit: 10 requests per 15 minutes per Cognito Identity ID
- Users can get new Identity ID by reinstalling app
- Consider implementing IP-based rate limiting with WAF for production

## Security

### Least-Privilege IAM
- Lambda can only invoke Bedrock Nova models (not other Bedrock models)
- Lambda can only access cache DynamoDB tables (not other tables)
- Lambda explicitly denied access to S3, EC2, RDS, Secrets Manager

### PII Protection
- Bedrock Guardrails block NAME, ADDRESS, AGE, EMAIL, PHONE
- Client-side validation ensures no PII in requests
- Backend validation acts as trust boundary

### Network Security
- API Gateway: HTTPS only
- IAM authentication required
- No public endpoints except API Gateway

## Cleanup

To destroy all resources:

```bash
cd infra/environments/dev
terraform destroy
```

**Warning**: This will delete all data in DynamoDB tables.
