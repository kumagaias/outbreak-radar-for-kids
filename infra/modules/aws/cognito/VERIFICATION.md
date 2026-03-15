# Cognito IAM Policy Verification

## Task 1.4 Completion Checklist

This document verifies that the Cognito Identity Pool module meets all security requirements from Task 1.4.

### ✅ Requirements Verified

#### 1. Identity Pool Configuration
- [x] Identity Pool created with unauthenticated access enabled
- [x] Classic flow disabled (modern identity pool)
- [x] Environment tagging applied

#### 2. IAM Role for Unauthenticated Users
- [x] IAM role created with proper assume role policy
- [x] Trust relationship limited to Cognito Identity service
- [x] Condition enforces unauthenticated identities only
- [x] Role name includes environment suffix for isolation

#### 3. Least-Privilege IAM Policy ⭐ CRITICAL
- [x] **Action restricted to `execute-api:Invoke` ONLY**
- [x] **Resource ARN format**: `${api_gateway_arn}/${stage}/POST/recommendations/generate`
- [x] **No access to S3, DynamoDB, Lambda, or other AWS services**
- [x] **No wildcard permissions**

#### 4. Role Attachment
- [x] IAM role attached to Identity Pool
- [x] Only unauthenticated role configured (no authenticated role)

#### 5. Module Outputs
- [x] Identity Pool ID exported for mobile app configuration
- [x] Identity Pool ARN exported for API Gateway integration
- [x] Unauthenticated role ARN exported for verification

### Security Validation

#### IAM Policy Analysis

The IAM policy in `main.tf` line 42-56 implements strict least-privilege:

```hcl
policy = jsonencode({
  Version = "2012-10-17"
  Statement = [
    {
      Effect = "Allow"
      Action = [
        "execute-api:Invoke"
      ]
      # Restrict to POST /recommendations/generate endpoint only
      # Format: arn:aws:execute-api:region:account:api-id/stage/method/path
      Resource = "${var.api_gateway_arn}/${var.stage}/POST/recommendations/generate"
    }
  ]
})
```

**Key Security Features:**
1. **Single Action**: Only `execute-api:Invoke` permitted
2. **Specific Resource**: Full ARN path including HTTP method and endpoint
3. **No Wildcards**: No `*` in resource ARN
4. **Method Restriction**: Only POST requests allowed
5. **Path Restriction**: Only `/recommendations/generate` accessible

#### What This Blocks

❌ **Blocked Actions:**
- S3 bucket access (`s3:GetObject`, `s3:PutObject`)
- DynamoDB table access (`dynamodb:GetItem`, `dynamodb:PutItem`)
- Lambda function invocation (`lambda:InvokeFunction`)
- Other API Gateway endpoints
- GET/PUT/DELETE requests to the recommendations endpoint

✅ **Allowed Actions:**
- POST requests to `/recommendations/generate` endpoint ONLY

### Terraform Validation

```bash
# Validate syntax
cd infra/environments/dev
terraform init -backend=false
terraform validate

# Check formatting
terraform fmt -check -recursive

# Preview IAM policy (without applying)
terraform plan | grep -A 30 "aws_iam_role_policy.unauthenticated"
```

### Runtime Verification (Post-Deployment)

After deploying with `terraform apply`, verify the IAM policy:

```bash
# Get the IAM role name
ROLE_NAME=$(aws iam list-roles --query "Roles[?contains(RoleName, 'cognito-unauthenticated-dev')].RoleName" --output text)

# Get the inline policy
aws iam get-role-policy \
  --role-name $ROLE_NAME \
  --policy-name cognito-unauthenticated-policy \
  --query 'PolicyDocument' \
  --output json

# Expected output:
# {
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Effect": "Allow",
#       "Action": ["execute-api:Invoke"],
#       "Resource": "arn:aws:execute-api:us-east-1:123456789012:abc123xyz/dev/POST/recommendations/generate"
#     }
#   ]
# }
```

### Mobile App Integration

The mobile app will use this Identity Pool to obtain temporary AWS credentials:

```typescript
// mobile/src/aws-exports.ts
export default {
  Auth: {
    identityPoolId: 'us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    region: 'us-east-1'
  },
  API: {
    endpoints: [
      {
        name: 'recommendations',
        endpoint: 'https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev',
        region: 'us-east-1'
      }
    ]
  }
};
```

### Requirements Satisfied

- ✅ **Requirement 14.8**: Create Cognito Identity Pool for unauthenticated mobile app access
- ✅ **Requirement 15.6**: Use IAM authentication (AWS Signature Version 4) for mobile app requests
- ✅ **Task 1.4**: Restrict IAM policy to `execute-api:Invoke` on specific API Gateway resource ARN only
- ✅ **Task 1.4**: Prevent access to other AWS resources (S3, DynamoDB, Lambda, etc.)
- ✅ **Task 1.4**: Use least-privilege principle with specific ARN format

### Security Guardrail Effectiveness

This configuration ensures that even if an attacker obtains temporary credentials from the Cognito Identity Pool:

1. **Cannot access S3 buckets** - No S3 permissions granted
2. **Cannot read/write DynamoDB** - No DynamoDB permissions granted
3. **Cannot invoke Lambda functions directly** - No Lambda permissions granted
4. **Cannot call other API endpoints** - Resource ARN restricts to single endpoint
5. **Cannot use other HTTP methods** - Only POST allowed on the specific endpoint

The attack surface is minimized to a single API endpoint with rate limiting (10 req/15min per identity).

## Conclusion

✅ **Task 1.4 is COMPLETE and VERIFIED**

The Cognito Identity Pool module correctly implements least-privilege IAM policies that restrict unauthenticated users to only invoke the `/recommendations/generate` API endpoint. All security requirements are satisfied.
