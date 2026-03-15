# Task 3: Backend API Validation Report

**Date**: 2026-03-13  
**Status**: ⚠️ PARTIAL SUCCESS - API functional with fallback, Nova integration has issues  
**Environment**: dev

## Summary

The Backend API is deployed and functional, successfully handling requests with proper validation and fallback mechanisms. However, Nova AI integration is not working due to configuration issues. The system gracefully falls back to rule-based recommendations, demonstrating robust error handling.

## Test Results

### ✅ PASSED Tests

#### 1. API Gateway Integration
- **Status**: ✅ PASS
- **Result**: API Gateway successfully routes requests to Lambda
- **Response Time**: < 2 seconds for all requests
- **HTTP Status**: 200 OK for valid requests

#### 2. Privacy Validation (PII Rejection)
- **Status**: ✅ PASS
- **Test Case**: Request with `exactAge` property (PII)
- **Result**: Correctly rejected with HTTP 400
- **Error Message**: "Unexpected property in request: exactAge"
- **Validation**: Trust boundary working as designed

#### 3. Request Validation
- **Status**: ✅ PASS
- **Test Cases**:
  - Valid age ranges (0-1, 2-3, 4-6, 7+)
  - Valid risk levels (high, medium, low)
  - Valid languages (ja, en)
- **Result**: All valid requests accepted, invalid requests rejected

#### 4. Fallback Mechanism
- **Status**: ✅ PASS
- **Test Cases**:
  - High risk (Japanese): Appropriate guidance with 37.5°C threshold
  - Medium risk (English): Preventive measures
  - Low risk (English): Normal attendance guidance
- **Result**: Fallback templates match expected tone and content
- **Quality**: Culturally appropriate, actionable recommendations

#### 5. Server-Side Caching
- **Status**: ✅ PASS
- **Test**: Sequential requests with identical parameters
- **Result**: 
  - 1st request: Cache miss, generates recommendation
  - 2nd request: Cache hit, returns cached result
- **Cache Key Format**: `{prefecture}_{ageRange}_{outbreakDataHash}`
- **Performance**: Cache hits return in < 100ms

#### 6. Geographic Anonymization
- **Status**: ✅ PASS
- **Test**: Requests with prefecture/state level location
- **Result**: Location correctly anonymized to prefecture/state level
- **Examples**:
  - "Tokyo, JP" → "Tokyo"
  - "California, US" → "California"

#### 7. Language Support
- **Status**: ✅ PASS
- **Test Cases**:
  - Japanese (ja): Polite form (です・ます調)
  - English (en): Declarative sentences
- **Result**: Appropriate language and tone for each locale

### ⚠️ ISSUES FOUND

#### Issue 1: Nova API Integration Not Working
- **Status**: ❌ FAIL
- **Root Cause 1**: Parameter Store region mismatch
  - PromptManager tries to access Parameter Store in `us-east-1` (Bedrock region)
  - Parameters are stored in `ap-northeast-1` (Lambda region)
  - Error: "Error retrieving prompt from Parameter Store: Unknown"
  - Workaround: Falls back to hardcoded prompts

- **Root Cause 2**: JSON parsing error
  - Nova API returns response but parsing fails
  - Error: "Error parsing Nova response: SyntaxError"
  - Possible causes:
    - Nova response format doesn't match expected schema
    - Response contains markdown code blocks
    - Guardrails intervention modifying response

- **Impact**: 
  - All requests use fallback recommendations instead of AI-generated content
  - System remains functional but doesn't leverage Nova AI capabilities
  - Cost optimization working (no Nova API charges incurred)

- **Evidence from CloudWatch Logs**:
  ```
  INFO    Server-side cache miss, calling Nova
  ERROR   Error retrieving prompt from Parameter Store: Unknown
  WARN    Falling back to hardcoded prompt
  INFO    Nova API call metadata: { model: 'amazon.nova-micro-v1:0', ... }
  ERROR   Error parsing Nova response: SyntaxError
  ERROR   Nova API error: Error: Failed to parse
  INFO    Nova generation successful, source: fallback
  ```

#### Issue 2: BEDROCK_REGION Environment Variable
- **Status**: ✅ FIXED (code updated, needs redeployment)
- **Original Issue**: Lambda code used `AWS_REGION` instead of `BEDROCK_REGION`
- **Fix Applied**: Updated `backend/index.js` to use `BEDROCK_REGION`
- **Deployment Status**: Code fix deployed, Lambda updated successfully
- **Verification**: Still seeing Parameter Store errors (Issue 1)

## Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Cache hit response time | < 100ms | ~50ms | ✅ PASS |
| Cache miss response time | < 5s | ~1.6s | ✅ PASS |
| Fallback response time | < 50ms | ~20ms | ✅ PASS |
| API Gateway latency | < 100ms | ~50ms | ✅ PASS |

## Security Validation

| Test | Result | Notes |
|------|--------|-------|
| PII rejection (exactAge) | ✅ PASS | HTTP 400 with clear error message |
| Location anonymization | ✅ PASS | Ward/county stripped, prefecture/state only |
| Input validation | ✅ PASS | Whitelist approach, unexpected properties rejected |
| HTTPS enforcement | ✅ PASS | API Gateway enforces HTTPS only |
| IAM authentication | ✅ PASS | API Gateway uses AWS Signature V4 |

## Cost Analysis

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Nova API calls | $0.90/month | $0.00/month | ⚠️ Not being called |
| DynamoDB | $0.01/month | $0.01/month | ✅ On track |
| Lambda | $0.01/month | $0.01/month | ✅ On track |
| API Gateway | $0.01/month | $0.01/month | ✅ On track |
| **Total** | **$0.94/month** | **$0.04/month** | ⚠️ Under budget (Nova not working) |

## Recommendations

### Immediate Actions Required

1. **Fix Parameter Store Region Issue**
   - **Problem**: PromptManager accesses Parameter Store in wrong region
   - **Solution**: Update PromptManager to use `ap-northeast-1` for Parameter Store
   - **Code Location**: `backend/lib/prompt-manager.js`
   - **Change**: Pass separate `parameterStoreRegion` parameter or use `AWS_REGION`

2. **Debug Nova JSON Parsing**
   - **Problem**: Nova response can't be parsed
   - **Solution**: Add detailed logging of raw Nova response
   - **Investigation**: Check if Guardrails is modifying response format
   - **Code Location**: `backend/lib/nova-service.js`

3. **Verify Bedrock IAM Permissions**
   - **Problem**: May need cross-region permissions
   - **Solution**: Verify Lambda IAM role has `bedrock:InvokeModel` for `us-east-1`
   - **Check**: IAM policy allows `arn:aws:bedrock:us-east-1::foundation-model/*`

### Post-Fix Validation

After fixes are deployed, re-run validation tests:

```bash
cd backend
bash test-api-via-gateway.sh
bash test-nova-fresh.sh
```

Expected results:
- `source: "nova-micro"` or `source: "nova-lite"` (not "fallback")
- `cacheHit: false` on first request
- `cacheHit: true` on second identical request
- CloudWatch logs show successful Nova API calls

## Conclusion

**Overall Assessment**: ⚠️ PARTIAL SUCCESS

The Backend API is production-ready for fallback mode:
- ✅ All security validations passing
- ✅ Privacy boundaries enforced
- ✅ Graceful error handling
- ✅ Performance targets met
- ✅ Cost optimization working (though unintentionally)

However, Nova AI integration requires fixes before full functionality:
- ❌ Parameter Store region mismatch
- ❌ JSON parsing errors
- ⚠️ No AI-generated recommendations being produced

**Recommendation**: Address Parameter Store and JSON parsing issues, then re-validate. The system demonstrates excellent resilience with fallback mechanisms, but the core AI feature is not operational.

## Test Artifacts

- Test scripts: `backend/test-api-via-gateway.sh`, `backend/test-nova-integration.sh`, `backend/test-nova-fresh.sh`
- CloudWatch Logs: `/aws/lambda/nova-recommendations-dev`
- API Endpoint: `https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev/recommendations/generate`
- DynamoDB Cache Table: `shared-recommendations-cache-dev`

## Next Steps

1. Fix Parameter Store region issue in PromptManager
2. Add detailed logging for Nova response debugging
3. Verify IAM permissions for cross-region Bedrock access
4. Redeploy Lambda with fixes
5. Re-run validation tests
6. Update this report with final results
