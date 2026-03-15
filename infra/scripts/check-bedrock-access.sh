#!/bin/bash
# Script to check Amazon Bedrock model access status for Nova Lite and Nova Micro

set -e

REGION="us-east-1"
NOVA_LITE_MODEL="amazon.nova-lite-v1:0"
NOVA_MICRO_MODEL="amazon.nova-micro-v1:0"

echo "Checking Bedrock model access in ${REGION}..."
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Error: AWS CLI is not configured. Run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI is configured"
echo ""

# Function to check model access
check_model_access() {
    local model_id=$1
    local model_name=$2
    
    echo "Checking ${model_name} (${model_id})..."
    
    # Try to get foundation model details
    if aws bedrock get-foundation-model \
        --model-identifier "${model_id}" \
        --region "${REGION}" &> /dev/null; then
        echo "  ✅ Model exists and is accessible"
        return 0
    else
        echo "  ❌ Model access not enabled"
        return 1
    fi
}

# Check both models
nova_lite_ok=false
nova_micro_ok=false

if check_model_access "${NOVA_LITE_MODEL}" "Nova Lite"; then
    nova_lite_ok=true
fi
echo ""

if check_model_access "${NOVA_MICRO_MODEL}" "Nova Micro"; then
    nova_micro_ok=true
fi
echo ""

# Summary
echo "=========================================="
echo "Summary:"
echo "=========================================="

if $nova_lite_ok && $nova_micro_ok; then
    echo "✅ All required models are accessible"
    echo ""
    echo "You can proceed with Terraform deployment:"
    echo "  cd infra/environments/dev"
    echo "  terraform init"
    echo "  terraform apply"
    exit 0
else
    echo "❌ Some models are not accessible"
    echo ""
    echo "To enable model access:"
    echo "1. Go to AWS Console: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess"
    echo "2. Click 'Manage model access'"
    echo "3. Enable the following models:"
    if ! $nova_lite_ok; then
        echo "   - Amazon Nova Lite"
    fi
    if ! $nova_micro_ok; then
        echo "   - Amazon Nova Micro"
    fi
    echo "4. Click 'Save changes'"
    echo "5. Wait 5-10 minutes for access to be granted"
    echo "6. Run this script again to verify"
    exit 1
fi
