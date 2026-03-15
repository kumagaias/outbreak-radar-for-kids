# Deployment Guide

## Backend Lambda Deployment

Backend Lambda functions are automatically deployed via GitHub Actions on push to `main` branch.

### Automatic Deployment Triggers

- **Nova Recommendations Lambda**: Triggers on changes to `backend/**` (excluding outbreak-fetcher)
- **Outbreak Data Fetcher Lambda**: Triggers on changes to `backend/lambda/outbreak-fetcher/**`

### Deployment Process

1. GitHub Actions detects changes in backend code
2. Builds Docker image for the changed Lambda function
3. Pushes image to Amazon ECR (Elastic Container Registry)
4. Updates Lambda function with new image

### Authentication

Uses AWS OIDC (OpenID Connect) for secure authentication:
- Role: `arn:aws:iam::${{ vars.AWS_ACCOUNT_ID }}:role/github-actions-outbreak-radar-for-kids-dev`
- Region: `ap-northeast-1`

**Required GitHub Variables:**
- `AWS_ACCOUNT_ID`: AWS account ID (set in repository settings → Secrets and variables → Actions → Variables)

### Workflow File

See [.github/workflows/deploy-lambda.yml](../../.github/workflows/deploy-lambda.yml) for implementation details.

### Manual Deployment

If manual deployment is needed:

```bash
# Set your AWS account ID
export AWS_ACCOUNT_ID=<your-account-id>

# Build and push Docker image
cd backend
docker build -t nova-recommendations:latest .
docker tag nova-recommendations:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest

# Update Lambda function
aws lambda update-function-code \
  --function-name nova-recommendations-dev \
  --image-uri ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest \
  --region ap-northeast-1
```

## Mobile App Deployment

Mobile app deployment is handled separately via AWS Amplify for web builds and Expo for native builds.

See [mobile/README.md](../../mobile/README.md) for details.
