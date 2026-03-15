# Cognito Identity Pool Security Configuration

## Overview

This module creates a Cognito Identity Pool for unauthenticated mobile app access with strict IAM policies following the principle of least privilege.

## Security Guardrails

### IAM Policy Restrictions

The unauthenticated IAM role is restricted to **ONLY** invoke the specific API Gateway endpoint:

```
Resource: arn:aws:execute-api:{region}:{account}:{api_id}/{stage}/POST/recommendations/generate
```

### What is Allowed

- ✅ POST requests to `/recommendations/generate` endpoint
- ✅ Temporary AWS credentials via Cognito Identity Pool

### What is Blocked

- ❌ Access to other API Gateway endpoints
- ❌ Access to S3 buckets
- ❌ Access to DynamoDB tables
- ❌ Access to Lambda functions
- ❌ Access to any other AWS services

## Verification

To verify the IAM policy is correctly configured:

```bash
cd infra/environments/dev
terraform plan | grep -A 20 "aws_iam_role_policy.unauthenticated"
```

Expected output should show:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["execute-api:Invoke"],
      "Resource": "arn:aws:execute-api:us-east-1:*:*/dev/POST/recommendations/generate"
    }
  ]
}
```

## Requirements Satisfied

- **Requirement 14.8**: Create Cognito Identity Pool for unauthenticated mobile app access
- **Requirement 15.6**: Use IAM authentication with least-privilege permissions
- **Task 1.4**: Restrict IAM policy to specific API Gateway resource ARN only
