#!/bin/bash

# Test with completely unique scenario to bypass cache

REGION="ap-northeast-1"
TIMESTAMP=$(date +%s)

echo "Testing Nova Integration - Fresh Request (timestamp: $TIMESTAMP)"
echo "============================================================"
echo ""

# Use unique combination with timestamp in disease name to force cache miss
aws apigateway test-invoke-method \
  --rest-api-id hexygw1gca \
  --resource-id $(aws apigateway get-resources --rest-api-id hexygw1gca --region $REGION --query 'items[?path==`/recommendations/generate`].id' --output text) \
  --http-method POST \
  --region $REGION \
  --body "{
    \"ageRange\": \"2-3\",
    \"geographicArea\": \"Kyoto, JP\",
    \"riskLevel\": \"medium\",
    \"language\": \"ja\",
    \"diseaseNames\": [\"COVID-19\"],
    \"outbreakData\": [
      {
        \"diseaseName\": \"COVID-19\",
        \"severity\": 6,
        \"geographicUnit\": { \"stateOrPrefecture\": \"Kyoto\" },
        \"affectedAgeRanges\": [\"2-3\", \"4-6\"]
      }
    ]
  }" 2>&1 | jq -r '.body' | jq '.'

echo ""
echo "============================================================"
echo "Checking CloudWatch Logs..."
sleep 2
aws logs tail /aws/lambda/nova-recommendations-dev --since 30s --region ap-northeast-1 2>&1 | grep -E "Nova|Bedrock|model" | tail -20
