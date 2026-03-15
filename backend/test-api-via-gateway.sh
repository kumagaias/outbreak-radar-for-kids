#!/bin/bash

# Task 3: Backend API Validation via API Gateway
# Tests the deployed API Gateway endpoint with real AWS services

API_ENDPOINT="https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev/recommendations/generate"
REGION="ap-northeast-1"

echo "Backend API Validation - Task 3"
echo "Testing API Gateway endpoint with AWS Signature V4"
echo ""
echo "Endpoint: $API_ENDPOINT"
echo "Region: $REGION"
echo ""

# Test 1: High Risk - Multiple Diseases
echo "============================================================"
echo "Test 1: High Risk - Multiple Diseases"
echo "============================================================"
aws apigateway test-invoke-method \
  --rest-api-id hexygw1gca \
  --resource-id $(aws apigateway get-resources --rest-api-id hexygw1gca --region $REGION --query 'items[?path==`/recommendations/generate`].id' --output text) \
  --http-method POST \
  --region $REGION \
  --body '{
    "ageRange": "2-3",
    "geographicArea": "Tokyo, JP",
    "riskLevel": "high",
    "language": "ja",
    "diseaseNames": ["RSV", "Influenza"],
    "outbreakData": [
      {
        "diseaseName": "RSV",
        "severity": 8,
        "geographicUnit": { "stateOrPrefecture": "Tokyo" },
        "affectedAgeRanges": ["0-1", "2-3"]
      },
      {
        "diseaseName": "Influenza",
        "severity": 7,
        "geographicUnit": { "stateOrPrefecture": "Tokyo" },
        "affectedAgeRanges": ["2-3", "4-6"]
      }
    ]
  }' 2>&1 | jq -r '.body' | jq '.'

echo ""
echo "Test 1 complete"
echo ""

# Test 2: Medium Risk
echo "============================================================"
echo "Test 2: Medium Risk"
echo "============================================================"
aws apigateway test-invoke-method \
  --rest-api-id hexygw1gca \
  --resource-id $(aws apigateway get-resources --rest-api-id hexygw1gca --region $REGION --query 'items[?path==`/recommendations/generate`].id' --output text) \
  --http-method POST \
  --region $REGION \
  --body '{
    "ageRange": "4-6",
    "geographicArea": "California, US",
    "riskLevel": "medium",
    "language": "en",
    "diseaseNames": ["Norovirus"],
    "outbreakData": [
      {
        "diseaseName": "Norovirus",
        "severity": 5,
        "geographicUnit": { "stateOrPrefecture": "California" },
        "affectedAgeRanges": ["4-6", "7+"]
      }
    ]
  }' 2>&1 | jq -r '.body' | jq '.'

echo ""
echo "Test 2 complete"
echo ""

# Test 3: Low Risk
echo "============================================================"
echo "Test 3: Low Risk"
echo "============================================================"
aws apigateway test-invoke-method \
  --rest-api-id hexygw1gca \
  --resource-id $(aws apigateway get-resources --rest-api-id hexygw1gca --region $REGION --query 'items[?path==`/recommendations/generate`].id' --output text) \
  --http-method POST \
  --region $REGION \
  --body '{
    "ageRange": "7+",
    "geographicArea": "New York, US",
    "riskLevel": "low",
    "language": "en",
    "diseaseNames": [],
    "outbreakData": []
  }' 2>&1 | jq -r '.body' | jq '.'

echo ""
echo "Test 3 complete"
echo ""

# Test 4: PII Rejection - Exact Age
echo "============================================================"
echo "Test 4: PII Rejection - Exact Age (should fail)"
echo "============================================================"
aws apigateway test-invoke-method \
  --rest-api-id hexygw1gca \
  --resource-id $(aws apigateway get-resources --rest-api-id hexygw1gca --region $REGION --query 'items[?path==`/recommendations/generate`].id' --output text) \
  --http-method POST \
  --region $REGION \
  --body '{
    "ageRange": "2-3",
    "geographicArea": "Tokyo, JP",
    "riskLevel": "high",
    "language": "ja",
    "diseaseNames": ["RSV"],
    "exactAge": 3,
    "outbreakData": [
      {
        "diseaseName": "RSV",
        "severity": 8,
        "geographicUnit": { "stateOrPrefecture": "Tokyo" },
        "affectedAgeRanges": ["2-3"]
      }
    ]
  }' 2>&1 | jq -r '.body' | jq '.'

echo ""
echo "Test 4 complete"
echo ""

echo "============================================================"
echo "Validation Complete"
echo "============================================================"
echo ""
echo "Next Steps:"
echo "1. Check CloudWatch Logs: aws logs tail /aws/lambda/nova-recommendations-dev --follow --region ap-northeast-1"
echo "2. Check CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=nova-recommendations-dev"
echo "3. Verify DynamoDB cache: aws dynamodb scan --table-name shared-recommendations-cache-dev --region ap-northeast-1"
