# Dummy Lambda Function

## Purpose

This is a placeholder Lambda function used for initial Terraform deployment. It solves the "chicken and egg" problem where Terraform needs deployable code to create the Lambda resource, but the actual backend code cannot be deployed until the infrastructure exists.

## Deployment Flow

1. **Initial Infrastructure Deployment** (Task 1.9)
   - Terraform uses this dummy code to create Lambda function
   - Creates all AWS resources (API Gateway, DynamoDB, Cognito, etc.)
   - Outputs API endpoint and Cognito pool ID

2. **Backend Code Deployment** (Task 2)
   - After infrastructure exists, deploy actual Nova recommendations Lambda
   - Use GitHub Actions or manual Docker deployment
   - Lambda function is updated with real implementation

## Dummy Function Behavior

- Returns HTTP 200 with "Hello World" message
- Logs incoming events to CloudWatch
- Includes timestamp and event details in response

## Replacement

This dummy code will be replaced by the actual implementation in `backend/` directory after Task 1.9 (infrastructure deployment) is complete.

See `docs/deployment.md` for deployment procedures.
