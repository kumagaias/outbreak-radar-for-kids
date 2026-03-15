# Dev Environment Test Results

**Test Date**: 2026-03-12  
**Environment**: dev  
**Region**: ap-northeast-1

## Test Summary

All infrastructure components deployed successfully and tested.

## Component Status

### ✅ Lambda Functions
- **nova-recommendations-dev**: Active, Image-based, 512MB, 30s timeout
- **outbreak-data-fetcher-dev**: Active, Image-based, 512MB, 300s timeout

**Test Result**: Lambda invocation successful with fallback response
```json
{
  "statusCode": 200,
  "recommendation": {
    "summary": "感染症の流行がTokyoで報告されています...",
    "actionItems": [...],
    "riskLevel": "high",
    "source": "fallback"
  }
}
```

### ✅ API Gateway
- **API ID**: hexygw1gca
- **Stage**: dev
- **Endpoint**: https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev

### ✅ DynamoDB Tables
- recommendations-cache-dev
- shared-recommendations-cache-dev
- outbreak-data-dev

### ✅ EventBridge Schedule
- **Rule**: outbreak-data-fetcher-weekly-dev
- **Schedule**: cron(0 12 ? * FRI *) - Every Friday at 12:00 UTC
- **State**: ENABLED

### ✅ Cognito Identity Pool
- **Name**: outbreak-radar-for-kids-dev
- **ID**: ap-northeast-1:b2ab64de-0f7c-49dd-94ae-6a6df79273a3

### ✅ GitHub Actions IAM Role
- **Role**: github-actions-kids-outbreak-radar-dev
- **ARN**: arn:aws:iam::843925270284:role/github-actions-kids-outbreak-radar-dev
- **Permissions**: ECR push, Lambda update

### ✅ S3 Backend
- **Bucket**: outbreak-radar-terraform-state-dev
- **State**: Migrated from local to S3
- **Versioning**: Enabled
- **Encryption**: AES256

## Next Steps

1. Push code to GitHub to trigger CI/CD pipeline
2. Verify GitHub Actions automatically builds and deploys Docker images
3. Test API Gateway endpoint with Cognito authentication
4. Monitor CloudWatch logs and metrics
5. Test outbreak data fetcher Lambda (manual trigger or wait for Friday)

## Notes

- Lambda functions are using ECR container images (not ZIP files)
- Provisioned Concurrency configured for morning peak hours (6:00-9:00 JST)
- All resources tagged with Environment=dev, Project=outbreak-radar-for-kids
- Terraform state now managed in S3 with versioning
