# Dev Environment Deployment Guide

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.14 installed
3. Docker installed (for Lambda container images)

## Initial Deployment

### Step 1: Create S3 Backend

```bash
cd infra/environments/dev/backend-bootstrap
terraform init
terraform apply
```

This creates the S3 bucket for Terraform state storage.

### Step 2: Add Backend Configuration

Add the following to `infra/environments/dev/main.tf` after the `terraform` block:

```hcl
terraform {
  backend "s3" {
    bucket = "outbreak-radar-terraform-state-dev"
    key    = "dev/terraform.tfstate"
    region = "ap-northeast-1"
  }
}
```

### Step 3: Migrate State to S3

```bash
cd infra/environments/dev
terraform init -migrate-state
```

Answer "yes" when prompted to migrate the state.

### Step 4: Build and Push Docker Images

```bash
# Build and push nova-recommendations Lambda
cd backend
docker build -t nova-recommendations:latest .
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 843925270284.dkr.ecr.ap-northeast-1.amazonaws.com
docker tag nova-recommendations:latest 843925270284.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest
docker push 843925270284.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest

# Build and push outbreak-fetcher Lambda
cd lambda/outbreak-fetcher
docker build -t outbreak-data-fetcher:latest .
docker tag outbreak-data-fetcher:latest 843925270284.dkr.ecr.ap-northeast-1.amazonaws.com/outbreak-data-fetcher-dev:latest
docker push 843925270284.dkr.ecr.ap-northeast-1.amazonaws.com/outbreak-data-fetcher-dev:latest
```

Or use the deployment script:

```bash
cd infra/scripts
./deploy-lambda.sh
```

### Step 5: Deploy Infrastructure

```bash
cd infra/environments/dev
terraform plan
terraform apply
```

### Step 6: Verify Deployment

```bash
# Check Lambda functions
aws lambda list-functions --region ap-northeast-1 | grep outbreak-radar

# Check API Gateway
aws apigateway get-rest-apis --region ap-northeast-1 | grep nova-recommendations

# Check DynamoDB tables
aws dynamodb list-tables --region ap-northeast-1 | grep -E "(cache|outbreak-data)"
```

## GitHub Actions CI/CD

After initial deployment, GitHub Actions will automatically:
1. Build Docker images when code changes
2. Push images to ECR
3. Update Lambda functions

The workflow uses OIDC (no tokens needed) and only triggers on relevant file changes.

## Updating Infrastructure

```bash
cd infra/environments/dev
terraform plan
terraform apply
```

## Updating Lambda Code

### Manual Update

```bash
cd infra/scripts
./deploy-lambda.sh
```

### Automatic Update (via GitHub Actions)

Push changes to `main` branch:
- Changes to `backend/**` trigger nova-recommendations deployment
- Changes to `backend/lambda/outbreak-fetcher/**` trigger outbreak-fetcher deployment

## Troubleshooting

### Lambda Function Not Found

If Lambda functions don't exist yet, Terraform will create them. Ensure Docker images are pushed to ECR first.

### State Lock Issues

S3 provides built-in state locking. If you encounter lock issues, check for concurrent Terraform operations.

### ECR Authentication

ECR login tokens expire after 12 hours. Re-authenticate:

```bash
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 843925270284.dkr.ecr.ap-northeast-1.amazonaws.com
```

## Outputs

After deployment, Terraform outputs:
- API Gateway endpoint URL
- Cognito Identity Pool ID
- ECR repository URLs
- Lambda function ARNs

Use these values to configure the mobile app.
