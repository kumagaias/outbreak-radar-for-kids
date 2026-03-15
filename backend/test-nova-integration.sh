#!/bin/bash

# Test Nova integration with a unique scenario to avoid cache

API_ENDPOINT="https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev/recommendations/generate"
REGION="ap-northeast-1"

echo "Testing Nova Integration with Fresh Scenario"
echo "============================================================"
echo ""

# Use a unique disease combination to avoid cache
aws apigateway test-invoke-method \
  --rest-api-id hexygw1gca \
  --resource-id $(aws apigateway get-resources --rest-api-id hexygw1gca --region $REGION --query 'items[?path==`/recommendations/generate`].id' --output text) \
  --http-method POST \
  --region $REGION \
  --body '{
    "ageRange": "0-1",
    "geographicArea": "Osaka, JP",
    "riskLevel": "high",
    "language": "ja",
    "diseaseNames": ["Hand-Foot-Mouth Disease", "Measles"],
    "outbreakData": [
      {
        "diseaseName": "Hand-Foot-Mouth Disease",
        "severity": 8,
        "geographicUnit": { "stateOrPrefecture": "Osaka" },
        "affectedAgeRanges": ["0-1", "2-3"]
      },
      {
        "diseaseName": "Measles",
        "severity": 9,
        "geographicUnit": { "stateOrPrefecture": "Osaka" },
        "affectedAgeRanges": ["0-1"]
      }
    ]
  }' 2>&1 | jq -r '.body' | jq '.'

echo ""
echo "============================================================"
echo "Check CloudWatch Logs for Nova API call:"
echo "aws logs tail /aws/lambda/nova-recommendations-dev --since 1m --region ap-northeast-1 | grep -i nova"
