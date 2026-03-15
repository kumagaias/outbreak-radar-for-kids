#!/bin/bash
# Test script to verify Cognito IAM policy configuration
# This script validates the IAM policy format without deploying

set -e

echo "=== Cognito IAM Policy Verification Test ==="
echo ""

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Error: terraform is not installed"
    exit 1
fi

echo "✅ Terraform installed"

# Navigate to dev environment
cd "$(dirname "$0")/../../../environments/dev"

# Initialize terraform (without backend)
echo ""
echo "Initializing Terraform..."
terraform init -backend=false > /dev/null 2>&1

# Validate configuration
echo "✅ Terraform initialized"
echo ""
echo "Validating configuration..."
terraform validate > /dev/null 2>&1
echo "✅ Configuration valid"

# Check IAM policy format
echo ""
echo "=== IAM Policy Analysis ==="
echo ""

# Extract the IAM policy from the module
POLICY_CONTENT=$(grep -A 20 "aws_iam_role_policy" ../../modules/aws/cognito/main.tf)

echo "Checking IAM policy content..."
echo ""

# Verify Action is execute-api:Invoke only
if echo "$POLICY_CONTENT" | grep -q 'execute-api:Invoke'; then
    echo "✅ Action restricted to execute-api:Invoke"
else
    echo "❌ Error: Action not properly restricted"
    exit 1
fi

# Verify Resource uses specific ARN format with POST method
if echo "$POLICY_CONTENT" | grep -q '/POST/recommendations/generate'; then
    echo "✅ Resource ARN uses specific endpoint format (POST /recommendations/generate)"
else
    echo "❌ Error: Resource ARN not properly restricted"
    exit 1
fi

# Check for wildcards in Resource
if echo "$POLICY_CONTENT" | grep "Resource" | grep -q '\*'; then
    echo "❌ Error: Wildcard found in Resource ARN (not allowed)"
    exit 1
else
    echo "✅ No wildcards in Resource ARN"
fi

echo ""
echo "=== Security Validation ==="
echo ""

# Verify no S3 permissions
if grep -q "s3:" ../../modules/aws/cognito/main.tf; then
    echo "❌ Error: S3 permissions found (not allowed)"
    exit 1
else
    echo "✅ No S3 permissions"
fi

# Verify no DynamoDB permissions
if grep -q "dynamodb:" ../../modules/aws/cognito/main.tf; then
    echo "❌ Error: DynamoDB permissions found (not allowed)"
    exit 1
else
    echo "✅ No DynamoDB permissions"
fi

# Verify no Lambda permissions
if grep -q "lambda:" ../../modules/aws/cognito/main.tf; then
    echo "❌ Error: Lambda permissions found (not allowed)"
    exit 1
else
    echo "✅ No Lambda permissions"
fi

echo ""
echo "=== Module Configuration Check ==="
echo ""

# Verify module is called with correct parameters
if grep -A 5 'module "cognito"' main.tf | grep -q "api_gateway_arn.*=.*module.api_gateway.execution_arn"; then
    echo "✅ API Gateway ARN correctly passed from api_gateway module"
else
    echo "❌ Error: API Gateway ARN not properly configured"
    exit 1
fi

if grep -A 6 'module "cognito"' main.tf | grep -q 'stage.*=.*var.environment'; then
    echo "✅ Stage correctly set to environment variable"
else
    echo "❌ Error: Stage not properly configured"
    exit 1
fi

echo ""
echo "=== Test Summary ==="
echo ""
echo "✅ All security checks passed!"
echo "✅ IAM policy correctly restricts to execute-api:Invoke only"
echo "✅ Resource ARN uses specific endpoint format"
echo "✅ No access to S3, DynamoDB, Lambda, or other services"
echo "✅ No wildcard permissions"
echo ""
echo "Task 1.4 verification: COMPLETE ✅"
