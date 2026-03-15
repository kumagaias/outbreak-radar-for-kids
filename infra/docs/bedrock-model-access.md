# Amazon Bedrock Model Access Setup

This document provides step-by-step instructions for enabling Amazon Bedrock model access for Nova Lite and Nova Micro.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured (`aws configure`)
- Access to AWS Console

## Required Models

- **Amazon Nova Lite** (amazon.nova-lite-v1:0)
- **Amazon Nova Micro** (amazon.nova-micro-v1:0)

## Region

Model access must be enabled in **us-east-1** region.

## Step 1: Check Current Access Status

Run the verification script:

```bash
cd infra
./scripts/check-bedrock-access.sh
```

If both models show "✅ Model exists and is accessible", you can skip to Step 3.

## Step 2: Enable Model Access via AWS Console

**IMPORTANT**: Model access must be enabled manually via AWS Console. This cannot be automated with Terraform.

### Instructions

1. **Navigate to Bedrock Model Access page**
   - Go to: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
   - Or: AWS Console → Services → Amazon Bedrock → Model access (ensure region is us-east-1)

2. **Click "Manage model access"**
   - This opens the model access management interface

3. **Enable required models**
   - Find "Amazon Nova Lite" in the list
   - Check the box next to it
   - Find "Amazon Nova Micro" in the list
   - Check the box next to it

4. **Save changes**
   - Click "Save changes" button at the bottom
   - You should see a success message

5. **Wait for access to be granted**
   - Status will change from "Requesting" to "Access granted"
   - This typically takes 2-5 minutes
   - You can refresh the page to check status

## Step 3: Verify Access

After enabling model access, verify it was successful:

```bash
cd infra
./scripts/check-bedrock-access.sh
```

Expected output:
```
Checking Bedrock model access in us-east-1...

✅ AWS CLI is configured

Checking Nova Lite (amazon.nova-lite-v1:0)...
  ✅ Model exists and is accessible

Checking Nova Micro (amazon.nova-micro-v1:0)...
  ✅ Model exists and is accessible

==========================================
Summary:
==========================================
✅ All required models are accessible

You can proceed with Terraform deployment:
  cd infra/environments/dev
  terraform init
  terraform apply
```

## Step 4: Proceed with Infrastructure Deployment

Once model access is verified, you can deploy the infrastructure:

```bash
cd infra/environments/dev
terraform init
terraform plan
terraform apply
```

## Troubleshooting

### Issue: "Access Denied" when checking model access

**Cause**: Your IAM user/role lacks permissions to view Bedrock models.

**Solution**: Ensure your IAM user/role has the following permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:GetFoundationModel",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

### Issue: Model access request stuck in "Requesting" status

**Cause**: AWS is processing your request.

**Solution**: Wait 5-10 minutes and refresh the page. If still stuck after 30 minutes, contact AWS Support.

### Issue: Cannot find "Model access" in Bedrock console

**Cause**: You may be in the wrong region.

**Solution**: Ensure you are in **us-east-1** region. Check the region selector in the top-right corner of AWS Console.

### Issue: Terraform fails with "Model not found" error

**Cause**: Model access is not enabled or not yet granted.

**Solution**: 
1. Run `./scripts/check-bedrock-access.sh` to verify access status
2. If models are not accessible, follow Step 2 to enable them
3. Wait for "Access granted" status
4. Re-run `terraform apply`

## IAM Policy for Lambda

The Lambda function's IAM role already includes the necessary permissions to invoke Bedrock models:

```hcl
# From infra/modules/aws/iam/main.tf
resource "aws_iam_role_policy" "bedrock_access" {
  name = "bedrock-nova-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = [
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
          "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:ApplyGuardrail"
        ]
        Resource = "*"
      }
    ]
  })
}
```

This policy:
- Allows Lambda to invoke Nova Lite and Nova Micro models only
- Allows Lambda to apply Bedrock Guardrails for PII filtering
- Follows least-privilege principle (no access to other models or services)

## Security Notes

- Model access is account-wide per region
- Once enabled, all IAM users/roles with `bedrock:InvokeModel` permission can use the models
- The Lambda IAM policy restricts access to only Nova Lite and Nova Micro
- Bedrock Guardrails provide additional PII filtering layer

## References

- [Amazon Bedrock Model Access Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Amazon Nova Models Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/models-nova.html)
- [Bedrock IAM Permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)
