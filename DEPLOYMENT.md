# Deployment Guide - Nova AI Recommendations MVP

This guide provides step-by-step instructions for deploying the Nova AI Recommendations backend infrastructure to AWS.

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **Terraform** installed (v1.0+)
4. **Node.js** installed (v20.x LTS)
5. **AWS Bedrock Model Access** enabled for Nova Lite and Nova Micro in us-east-1

## Step 1: Verify AWS Credentials

```bash
# Verify AWS CLI is configured
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-user"
# }
```

## Step 2: Enable Bedrock Model Access

**IMPORTANT**: This step must be done manually via AWS Console.

1. Navigate to AWS Console → Bedrock → Model access (us-east-1 region)
2. Click "Manage model access"
3. Enable the following models:
   - Amazon Nova Lite
   - Amazon Nova Micro
4. Click "Save changes"
5. Wait for status to change to "Access granted" (may take a few minutes)

## Step 3: Install Backend Dependencies

```bash
cd backend
npm install
```

## Step 4: Run Backend Tests

```bash
# Run all tests
npm test

# Expected output:
# PASS  __tests__/data-anonymizer.test.js
# PASS  __tests__/shared-cache-manager.test.js
# PASS  __tests__/nova-service.test.js
# PASS  __tests__/handler.test.js
#
# Test Suites: 4 passed, 4 total
# Tests:       47 passed, 47 total
# Coverage:    60%+
```

## Step 5: Initialize Terraform

```bash
cd ../infra/environments/dev
terraform init

# Expected output:
# Initializing modules...
# Initializing the backend...
# Initializing provider plugins...
# Terraform has been successfully initialized!
```

## Step 6: Review Terraform Plan

```bash
terraform plan

# Review the plan output carefully
# Expected resources to be created:
# - Lambda function (nova-recommendations-dev)
# - IAM role and policies
# - DynamoDB tables (2)
# - API Gateway REST API
# - Cognito Identity Pool
# - Bedrock Guardrails
# - CloudWatch Log Group, Alarms, Dashboard
```

## Step 7: Deploy Infrastructure

```bash
terraform apply

# Type 'yes' when prompted
# Deployment takes approximately 2-3 minutes

# Expected output:
# Apply complete! Resources: 25 added, 0 changed, 0 destroyed.
#
# Outputs:
# api_gateway_endpoint = "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev"
# cognito_identity_pool_id = "us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# dynamodb_cache_table_name = "recommendations-cache-dev"
# dynamodb_shared_cache_table_name = "shared-recommendations-cache-dev"
# guardrail_id = "xxxxxxxxxx"
```

## Step 8: Save Terraform Outputs

```bash
# Save outputs to a file for mobile app configuration
terraform output -json > ../../../terraform-outputs.json

# Display outputs
terraform output
```

## Step 9: Test Backend API Manually

### Test 1: Valid Request (Japanese, High Risk)

```bash
# Set variables
API_ENDPOINT=$(terraform output -raw api_gateway_endpoint)
IDENTITY_POOL_ID=$(terraform output -raw cognito_identity_pool_id)

# Get temporary AWS credentials from Cognito
aws cognito-identity get-id \
  --identity-pool-id $IDENTITY_POOL_ID \
  --region us-east-1

# Get credentials for the identity
IDENTITY_ID="<identity-id-from-previous-command>"
aws cognito-identity get-credentials-for-identity \
  --identity-id $IDENTITY_ID \
  --region us-east-1

# Use AWS CLI to invoke API with IAM signature
aws apigatewayv2 invoke \
  --api-id <api-id> \
  --stage dev \
  --request-body '{
    "ageRange": "2-3",
    "geographicArea": "Tokyo, JP",
    "riskLevel": "high",
    "language": "ja",
    "diseaseNames": ["RSV", "Influenza"],
    "outbreakData": [
      {
        "diseaseName": "RSV",
        "severity": 8,
        "geographicUnit": {
          "stateOrPrefecture": "Tokyo"
        },
        "affectedAgeRanges": ["0-1", "2-3"]
      }
    ]
  }' \
  response.json

# Check response
cat response.json
```

### Test 2: Invalid Request (Should Return 400)

```bash
# Test with invalid age range
curl -X POST $API_ENDPOINT/recommendations/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ageRange": "3.5",
    "geographicArea": "Tokyo, JP",
    "riskLevel": "high",
    "language": "ja"
  }'

# Expected response:
# {
#   "error": "Invalid request parameters",
#   "details": ["Invalid ageRange: 3.5. Must be one of: 0-1, 2-3, 4-6, 7+"],
#   "timestamp": "2024-01-01T00:00:00Z"
# }
```

### Test 3: Server-Side Cache (Second Request Should Hit Cache)

```bash
# Make the same request twice
# First request: Cache miss, calls Nova
# Second request: Cache hit, returns cached data

# First request
time curl -X POST $API_ENDPOINT/recommendations/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ageRange": "2-3",
    "geographicArea": "Tokyo, JP",
    "riskLevel": "high",
    "language": "ja",
    "diseaseNames": ["RSV"]
  }'

# Second request (should be faster)
time curl -X POST $API_ENDPOINT/recommendations/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ageRange": "2-3",
    "geographicArea": "Tokyo, JP",
    "riskLevel": "high",
    "language": "ja",
    "diseaseNames": ["RSV"]
  }'

# Check response for "cacheHit": true
```

## Step 10: Verify CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/nova-recommendations-dev --follow

# Expected log entries:
# - Request ID
# - Cache key
# - Cache hit/miss status
# - Recommendation source (cache/nova-lite/nova-micro/fallback)
# - Duration metrics
```

## Step 11: Check CloudWatch Dashboard

1. Navigate to AWS Console → CloudWatch → Dashboards
2. Open "nova-recommendations-dev-dashboard"
3. Verify metrics are being collected:
   - Lambda invocations
   - Lambda errors
   - Lambda duration
   - Cache hit rate
   - Nova API calls

## Step 12: Update Mobile App Configuration

```bash
cd ../../../mobile

# Create or update aws-exports.ts
cat > src/aws-exports.ts << EOF
export default {
  aws_project_region: 'us-east-1',
  aws_cognito_identity_pool_id: '$(terraform output -raw cognito_identity_pool_id)',
  aws_appsync_graphqlEndpoint: '$(terraform output -raw api_gateway_endpoint)',
  aws_appsync_region: 'us-east-1',
  aws_appsync_authenticationType: 'AWS_IAM'
};
EOF
```

## Step 13: Test Mobile App Integration

```bash
# Install mobile dependencies
npm install

# Run mobile app tests
npm test

# Start development server
npm run dev
```

## Step 14: Monitor Costs

```bash
# Check estimated costs in CloudWatch dashboard
# Navigate to: CloudWatch → Dashboards → nova-recommendations-dev-dashboard

# Expected monthly costs (100 requests/day, 80% cache hit):
# - Nova API: ~$0.90/month
# - DynamoDB: ~$0.01/month
# - Lambda: ~$0.01/month
# - API Gateway: ~$0.01/month
# - CloudWatch: ~$0.01/month
# Total: ~$0.94/month
```

## Troubleshooting

### Issue: Terraform Apply Fails with "Model Access Not Enabled"

**Solution**: Enable Bedrock model access manually via AWS Console (Step 2)

### Issue: Lambda Function Timeout

**Possible Causes**:
1. Nova API is slow (check us-east-1 region)
2. Network connectivity issues
3. Guardrails blocking request

**Solution**:
- Check CloudWatch Logs for error details
- Verify Guardrail configuration
- Test with fallback templates

### Issue: API Gateway Returns 403 Forbidden

**Possible Causes**:
1. IAM authentication not configured correctly
2. Cognito Identity Pool not set up
3. API Gateway resource policy issue

**Solution**:
- Verify Cognito Identity Pool ID in mobile app
- Check IAM role permissions
- Review API Gateway logs

### Issue: Cache Not Working

**Possible Causes**:
1. DynamoDB table permissions
2. Cache key generation issue
3. TTL not configured

**Solution**:
- Check Lambda IAM role has DynamoDB permissions
- Verify cache key format in logs
- Check DynamoDB table TTL settings

## Rollback

If deployment fails or you need to rollback:

```bash
cd infra/environments/dev
terraform destroy

# Type 'yes' when prompted
# All resources will be deleted
```

## Next Steps

After successful deployment:

1. ✅ Verify all tests pass
2. ✅ Verify mobile app can call backend API
3. ✅ Verify server-side caching reduces costs
4. ✅ Verify Guardrails blocks PII
5. ✅ Monitor CloudWatch metrics for 24 hours
6. ✅ Review cost estimates in CloudWatch dashboard

## Production Deployment

To deploy to production:

```bash
cd infra/environments/prod

# Update terraform.tfvars with production settings
# - Increase Lambda memory if needed
# - Adjust rate limiting
# - Configure custom domain

terraform init
terraform plan
terraform apply
```

## Support

For issues or questions:
- Check CloudWatch Logs: `/aws/lambda/nova-recommendations-dev`
- Review Terraform state: `terraform show`
- Check AWS Console for resource status
- Review backend README: `backend/README.md`
- Review infrastructure README: `infra/README.md`
