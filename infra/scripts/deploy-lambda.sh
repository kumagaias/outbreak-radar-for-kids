#!/bin/bash
set -e

# Deploy Lambda functions to ECR and update Lambda
# Usage: ./deploy-lambda.sh <environment> [function_name]
# Example: ./deploy-lambda.sh dev
# Example: ./deploy-lambda.sh dev nova-recommendations

ENVIRONMENT=${1:-dev}
FUNCTION_NAME=${2:-all}
AWS_REGION="ap-northeast-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Deploying Lambda functions to environment: $ENVIRONMENT"
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"

# Get ECR repository URLs from Terraform outputs
cd "$(dirname "$0")/../environments/$ENVIRONMENT"
ECR_LAMBDA_REPO=$(terraform output -raw ecr_lambda_repository_url 2>/dev/null || echo "")
ECR_OUTBREAK_REPO=$(terraform output -raw ecr_outbreak_fetcher_repository_url 2>/dev/null || echo "")

if [ -z "$ECR_LAMBDA_REPO" ] || [ -z "$ECR_OUTBREAK_REPO" ]; then
  echo "Error: ECR repositories not found. Run 'terraform apply' first to create ECR repositories."
  exit 1
fi

echo "ECR Lambda Repository: $ECR_LAMBDA_REPO"
echo "ECR Outbreak Fetcher Repository: $ECR_OUTBREAK_REPO"

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Function to build and push Docker image
build_and_push() {
  local DOCKERFILE_PATH=$1
  local ECR_REPO=$2
  local LAMBDA_NAME=$3
  
  echo ""
  echo "Building Docker image for $LAMBDA_NAME..."
  cd "$DOCKERFILE_PATH"
  
  # Build Docker image
  docker build --platform linux/amd64 -t $LAMBDA_NAME:latest .
  
  # Tag image for ECR
  docker tag $LAMBDA_NAME:latest $ECR_REPO:latest
  
  # Push to ECR
  echo "Pushing image to ECR..."
  docker push $ECR_REPO:latest
  
  # Update Lambda function
  echo "Updating Lambda function..."
  aws lambda update-function-code \
    --function-name $LAMBDA_NAME-$ENVIRONMENT \
    --image-uri $ECR_REPO:latest \
    --region $AWS_REGION \
    --no-cli-pager
  
  echo "✓ $LAMBDA_NAME deployed successfully"
}

# Deploy nova-recommendations Lambda
if [ "$FUNCTION_NAME" = "all" ] || [ "$FUNCTION_NAME" = "nova-recommendations" ]; then
  build_and_push "$(dirname "$0")/../../backend" "$ECR_LAMBDA_REPO" "nova-recommendations"
fi

# Deploy outbreak-data-fetcher Lambda
if [ "$FUNCTION_NAME" = "all" ] || [ "$FUNCTION_NAME" = "outbreak-data-fetcher" ]; then
  build_and_push "$(dirname "$0")/../../backend/lambda/outbreak-fetcher" "$ECR_OUTBREAK_REPO" "outbreak-data-fetcher"
fi

echo ""
echo "✓ All Lambda functions deployed successfully to $ENVIRONMENT environment"
