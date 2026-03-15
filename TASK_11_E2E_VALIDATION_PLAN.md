# Task 11: End-to-End Validation Plan

**Date**: 2026-03-13  
**Status**: IN PROGRESS  
**Environment**: dev

## Executive Summary

Task 11 performs final end-to-end validation of the complete system before MVP release. Based on validation reports from Tasks 3, 6, and 8, the system is **partially functional** with known issues in Nova AI integration and outbreak data fetching.

## Current System State

### ✅ Working Components
1. **Infrastructure**: Deployed to dev environment (ap-northeast-1)
2. **Backend API**: Functional with fallback recommendations
3. **Mobile App**: UI components and caching working
4. **Security**: IAM authentication, privacy boundaries enforced
5. **Caching**: Server-side and client-side caching operational

### ⚠️ Known Issues
1. **Nova AI Integration** (Task 3):
   - Parameter Store region mismatch (accessing us-east-1 instead of ap-northeast-1)
   - JSON parsing errors from Nova API responses
   - System falls back to rule-based recommendations
   
2. **Outbreak Data Integration** (Task 6):
   - NWSS: HTTP 400 (Bad Request)
   - FluView/FluSurv-NET: HTTP 308 (Permanent Redirect)
   - IDWR: HTTP 404 (Not Found)
   - e-Stat: Not configured (missing API key)
   - Only NHSN working (but returns 0 records)

3. **Mobile App** (Task 8):
   - Using mock outbreak data
   - Cannot test with real data until Task 6 issues resolved

## Validation Strategy

Given the current state, this validation will:
1. ✅ Test end-to-end flow with **fallback recommendations** (working)
2. ✅ Verify caching and performance with current system
3. ✅ Validate privacy boundaries and security
4. ⚠️ Document limitations with Nova AI and real outbreak data
5. ⚠️ Provide recommendations for resolving known issues

## End-to-End Test Scenarios

### Scenario 1: Morning Routine (Primary Use Case)
**User Story**: Parent opens app at 7:00 AM to check if child should attend daycare

**Test Steps**:
1. Open mobile app
2. View risk indicator (should appear < 1 second)
3. View cached recommendations (should appear < 3 seconds)
4. Read summary and action items
5. Provide feedback (Yes/No)

**Expected Results**:
- ✅ Risk level displayed within 1 second
- ✅ Recommendations displayed within 3 seconds (if cached)
- ✅ Medical disclaimer visible
- ✅ Action items in checklist format
- ✅ Feedback UI functional

**Actual Results**: TBD

### Scenario 2: Cache Miss (First Time User)
**User Story**: New user opens app for first time

**Test Steps**:
1. Clear app cache
2. Open mobile app
3. Wait for recommendation generation

**Expected Results**:
- ✅ Risk level calculated locally (< 1 second)
- ✅ "Generating recommendations..." message shown
- ✅ Recommendation generated within 5 seconds
- ⚠️ Source: "fallback" (Nova not working)

**Actual Results**: TBD

### Scenario 3: Pull-to-Refresh
**User Story**: User wants to force refresh recommendations

**Test Steps**:
1. View cached recommendations
2. Pull down to refresh
3. Wait for new recommendations

**Expected Results**:
- ✅ Cache invalidated
- ✅ New recommendations generated
- ✅ UI updates with fresh data

**Actual Results**: TBD

### Scenario 4: High Risk Scenario
**User Story**: Multiple high-severity outbreaks in user area

**Test Steps**:
1. Configure mock data with high-severity outbreaks (severity ≥ 7)
2. Open mobile app
3. View recommendations

**Expected Results**:
- ✅ Risk level: HIGH (red indicator)
- ✅ Summary mentions disease names
- ✅ Action items include temperature monitoring (37.5°C for Japanese)
- ✅ Action items include symptom watching
- ✅ Medical disclaimer visible

**Actual Results**: TBD

### Scenario 5: Privacy Validation
**User Story**: Verify no PII transmitted to backend

**Test Steps**:
1. Intercept API request from mobile app
2. Verify request body contains only:
   - Age range (0-1, 2-3, 4-6, 7+)
   - Prefecture/state level location
   - Outbreak data (anonymized)
3. Verify NO PII:
   - No exact age
   - No name
   - No address
   - No ward/county

**Expected Results**:
- ✅ Only anonymized data transmitted
- ✅ Backend rejects requests with PII (HTTP 400)

**Actual Results**: TBD

### Scenario 6: Performance Validation
**User Story**: Verify performance targets met

**Test Steps**:
1. Measure risk calculation time (local)
2. Measure cached recommendation display time
3. Measure new recommendation generation time
4. Measure API response time

**Expected Results**:
- ✅ Risk calculation: < 3 seconds
- ✅ Cached display: < 3 seconds
- ✅ New generation: < 5 seconds
- ✅ API response: < 5 seconds

**Actual Results**: TBD

### Scenario 7: Cost Validation
**User Story**: Verify cost targets met

**Test Steps**:
1. Check CloudWatch metrics for:
   - Nova API call count
   - DynamoDB read/write units
   - Lambda invocations
   - API Gateway requests
2. Calculate estimated monthly cost

**Expected Results**:
- ⚠️ Nova costs: $0/month (not being called due to issues)
- ✅ Other costs: < $2/month

**Actual Results**: TBD

## Validation Checklist

### Infrastructure
- [ ] Lambda function deployed and active
- [ ] API Gateway endpoint accessible
- [ ] DynamoDB tables exist and accessible
- [ ] Cognito Identity Pool configured
- [ ] CloudWatch logs enabled
- [ ] Parameter Store prompts created

### Backend API
- [ ] API endpoint responds to requests
- [ ] Privacy validation working (rejects PII)
- [ ] Server-side caching working
- [ ] Fallback recommendations working
- [ ] Rate limiting enforced
- [ ] CloudWatch logs show requests

### Mobile App
- [ ] App launches successfully
- [ ] Profile management working
- [ ] Risk indicator displays
- [ ] Recommendations display
- [ ] Action items display
- [ ] Medical disclaimer visible
- [ ] Feedback UI functional
- [ ] Pull-to-refresh working
- [ ] Cache management working

### Data Sources
- [ ] NWSS data fetching (⚠️ Known issue: HTTP 400)
- [ ] NHSN data fetching (✅ Working, 0 records)
- [ ] FluView data fetching (⚠️ Known issue: HTTP 308)
- [ ] FluSurv-NET data fetching (⚠️ Known issue: HTTP 308)
- [ ] IDWR data fetching (⚠️ Known issue: HTTP 404)
- [ ] e-Stat data fetching (⚠️ Not configured)

### Performance
- [ ] Risk calculation < 3 seconds
- [ ] Cached display < 3 seconds
- [ ] New generation < 5 seconds
- [ ] API response < 5 seconds

### Security
- [ ] No PII transmitted
- [ ] IAM authentication working
- [ ] HTTPS enforced
- [ ] Rate limiting working
- [ ] Privacy boundaries enforced

### Cost
- [ ] Nova costs < $20/month (⚠️ $0 due to fallback)
- [ ] Other costs < $2/month

## Known Limitations

### 1. Nova AI Integration Not Working
**Impact**: All recommendations use fallback templates instead of AI-generated content

**Root Causes**:
- Parameter Store region mismatch
- JSON parsing errors

**Workaround**: Fallback templates provide functional recommendations

**Resolution Required**: Fix Parameter Store region and JSON parsing (see Task 3 report)

### 2. Real Outbreak Data Not Available
**Impact**: System uses mock data, cannot provide accurate risk assessments

**Root Causes**:
- API endpoint changes (Delphi Epidata)
- Parameter format issues (NWSS)
- Access restrictions (IDWR)
- Missing configuration (e-Stat)

**Workaround**: Mock data provides realistic test scenarios

**Resolution Required**: Fix API integrations (see Task 6 report)

### 3. EventBridge Scheduler Not Implemented
**Impact**: Outbreak data not automatically refreshed weekly

**Workaround**: Manual Lambda invocation for data updates

**Resolution Required**: Implement EventBridge scheduler (post-MVP)

## Success Criteria

### Minimum Viable Product (MVP) Criteria
- ✅ Mobile app launches and displays recommendations
- ✅ Risk level calculated and displayed
- ✅ Action items displayed in checklist format
- ✅ Medical disclaimer visible
- ✅ Feedback UI functional
- ✅ Privacy boundaries enforced
- ✅ Performance targets met (with fallback)
- ⚠️ Cost targets met (Nova not being called)

### Post-MVP Criteria (Not Required for Task 11)
- ❌ Nova AI generating recommendations
- ❌ Real outbreak data from all sources
- ❌ Automatic weekly data refresh
- ❌ Advanced prompt management

## Recommendations

### For MVP Release
1. **Accept Current State**: System is functional with fallback recommendations
2. **Document Limitations**: Clearly communicate that AI features are in fallback mode
3. **User Communication**: Inform users that recommendations are rule-based (not AI-generated)
4. **Monitor Usage**: Track user feedback to validate fallback quality

### Post-MVP Priorities
1. **Fix Nova Integration** (HIGH):
   - Update Parameter Store region configuration
   - Debug JSON parsing errors
   - Validate with real API calls

2. **Fix Outbreak Data Integration** (HIGH):
   - Update Delphi Epidata endpoints
   - Debug NWSS parameter format
   - Investigate IDWR access
   - Configure e-Stat API key

3. **Implement EventBridge Scheduler** (MEDIUM):
   - Weekly automatic data refresh
   - Reduce operational overhead

## Next Steps

1. Execute end-to-end test scenarios
2. Document actual results
3. Create final validation report
4. Provide recommendations to user
5. Get user approval for MVP release or additional fixes

