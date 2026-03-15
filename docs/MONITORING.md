# Monitoring and Troubleshooting Guide

## CloudWatch Dashboard

### Key Metrics to Monitor

1. **Nova API Calls**
   - Metric: `NovaAPICallCount`
   - Namespace: `OutbreakRadar/Recommendations`
   - Target: <1000 calls/day (~$20/month budget)
   - Alert threshold: >1200 calls/day

2. **Cache Hit Rate**
   - Metric: `CacheHitRate`
   - Namespace: `OutbreakRadar/Recommendations`
   - Target: >80%
   - Alert threshold: <70%

3. **Lambda Execution Time**
   - Metric: `Duration`
   - Namespace: `AWS/Lambda`
   - Target: <5000ms (5 seconds)
   - Alert threshold: >4000ms (4 seconds)

4. **Lambda Error Rate**
   - Metric: `Errors`
   - Namespace: `AWS/Lambda`
   - Target: <1%
   - Alert threshold: >5%

5. **API Gateway 4xx/5xx Errors**
   - Metric: `4XXError`, `5XXError`
   - Namespace: `AWS/ApiGateway`
   - Target: <5%
   - Alert threshold: >10%

6. **DynamoDB Throttling**
   - Metric: `UserErrors`
   - Namespace: `AWS/DynamoDB`
   - Target: 0
   - Alert threshold: >0

### Dashboard Access

```bash
# Open CloudWatch dashboard
aws cloudwatch get-dashboard \
  --dashboard-name outbreak-radar-recommendations-dev \
  --region ap-northeast-1
```

## CloudWatch Alarms

### Critical Alarms

1. **Lambda Error Rate > 5%**
   - Action: Investigate logs immediately
   - SNS Topic: `outbreak-radar-critical-alerts`

2. **Lambda Duration > 4s**
   - Action: Check Bedrock API latency
   - SNS Topic: `outbreak-radar-performance-alerts`

3. **Nova API Calls > 1200/day**
   - Action: Review cache hit rate
   - SNS Topic: `outbreak-radar-cost-alerts`

### Alarm Configuration

```bash
# List all alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix outbreak-radar \
  --region ap-northeast-1
```

## Common Errors and Resolutions

### 1. Lambda Timeout (503 Service Unavailable)

**Symptoms:**
- API returns 503 error
- CloudWatch logs show "Task timed out after 30.00 seconds"

**Root Causes:**
- Bedrock API latency >5s
- Network issues to us-east-1
- Cold start during peak hours

**Resolution:**
1. Check Bedrock API status: https://status.aws.amazon.com/
2. Review Lambda logs for Bedrock call duration
3. Consider enabling Provisioned Concurrency for peak hours
4. Verify fallback logic triggered correctly

### 2. High Nova API Costs (>$20/month)

**Symptoms:**
- CloudWatch metric `NovaAPICallCount` >1000/day
- AWS bill shows unexpected Bedrock charges

**Root Causes:**
- Low cache hit rate (<70%)
- Cache invalidation too aggressive
- Outbreak data changing too frequently

**Resolution:**
1. Check cache hit rate metric
2. Review cache key generation logic
3. Verify outbreak data quantization working correctly
4. Consider increasing cache TTL from 10 days to 14 days

### 3. Privacy Validation Failures (400 Bad Request)

**Symptoms:**
- API returns 400 error with "PII detected" message
- Mobile app shows "Invalid request" error

**Root Causes:**
- Mobile app sending ward/county level data
- Exact age instead of age range
- PII in request body

**Resolution:**
1. Review mobile app data anonymization logic
2. Check DataAnonymizer implementation
3. Verify age range conversion working correctly
4. Test with sample requests to identify PII leakage

### 4. DynamoDB Throttling

**Symptoms:**
- API returns 500 error
- CloudWatch logs show "ProvisionedThroughputExceededException"

**Root Causes:**
- Burst traffic exceeding on-demand capacity
- Hot partition key (same cache key accessed repeatedly)

**Resolution:**
1. Verify on-demand billing mode enabled
2. Review cache key distribution
3. Check for retry storms from mobile app
4. Consider adding exponential backoff in mobile app

### 5. Bedrock Guardrails Blocking Requests

**Symptoms:**
- API returns fallback recommendations frequently
- CloudWatch logs show "Guardrails blocked request"

**Root Causes:**
- System prompt contains blocked content
- Outbreak data contains sensitive information
- Guardrails configuration too strict

**Resolution:**
1. Review Bedrock Guardrails logs
2. Check system prompt for blocked phrases
3. Verify outbreak data sanitization
4. Adjust Guardrails configuration if needed

## Log Analysis

### Useful CloudWatch Logs Insights Queries

#### 1. Find all errors in last 24 hours

```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

#### 2. Calculate average Lambda duration

```
fields @duration
| stats avg(@duration) as avg_duration, max(@duration) as max_duration, min(@duration) as min_duration
```

#### 3. Count cache hits vs misses

```
fields @message
| filter @message like /cache_hit/ or @message like /cache_miss/
| stats count(*) by @message
```

#### 4. Find requests with PII detected

```
fields @timestamp, @message
| filter @message like /PII detected/
| sort @timestamp desc
| limit 50
```

#### 5. Track Nova model selection

```
fields @timestamp, @message
| filter @message like /Selected Nova model/
| parse @message "Selected Nova model: *" as model
| stats count(*) by model
```

## Cost Monitoring

### Monthly Cost Targets

- **Nova API**: <$20/month (~1000 calls/day)
- **Lambda**: <$1/month (with Provisioned Concurrency: ~$5-10/month)
- **DynamoDB**: <$0.50/month (on-demand)
- **API Gateway**: <$0.50/month
- **CloudWatch Logs**: <$0.50/month
- **Total**: <$22/month (without Provisioned Concurrency)

### Cost Tracking

```bash
# Get current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

**cost-filter.json:**
```json
{
  "Tags": {
    "Key": "Project",
    "Values": ["outbreak-radar-for-kids"]
  }
}
```

## Performance Optimization

### 1. Cache Hit Rate Optimization

Target: >80% cache hit rate

**Actions:**
- Monitor cache key distribution
- Verify outbreak data quantization
- Adjust cache TTL if needed
- Review cache invalidation logic

### 2. Lambda Cold Start Reduction

Target: <500ms cold start latency

**Actions:**
- Enable Provisioned Concurrency for peak hours (6:00-9:00 JST)
- Use Application Auto Scaling to scale to 0 outside peak hours
- Monitor cold start frequency in CloudWatch

### 3. Bedrock API Latency Reduction

Target: <3s Bedrock API response time

**Actions:**
- Use Nova Micro for low/medium risk (faster, cheaper)
- Use Nova Lite only for complex high risk scenarios
- Monitor Bedrock API latency in CloudWatch
- Consider migrating to Tokyo region (ap-northeast-1) when available

## Incident Response

### Severity Levels

1. **Critical (P0)**: Service completely down, all users affected
2. **High (P1)**: Major functionality broken, >50% users affected
3. **Medium (P2)**: Minor functionality broken, <50% users affected
4. **Low (P3)**: Cosmetic issues, no user impact

### Response Procedures

#### P0: Service Down

1. Check AWS Service Health Dashboard
2. Review CloudWatch alarms
3. Check Lambda error logs
4. Verify API Gateway status
5. Roll back recent deployments if needed
6. Notify users via app notification

#### P1: High Error Rate

1. Review CloudWatch error logs
2. Check Bedrock API status
3. Verify DynamoDB availability
4. Monitor cache hit rate
5. Consider enabling fallback mode

#### P2: Performance Degradation

1. Check Lambda duration metrics
2. Review Bedrock API latency
3. Verify cache hit rate
4. Monitor DynamoDB throttling
5. Optimize cache key generation

## Health Checks

### Automated Health Checks

Run every 5 minutes:

```bash
# Check API Gateway health
curl -X POST https://api.outbreak-radar.example.com/recommendations/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ageRange": "2-3",
    "geographicArea": "Tokyo",
    "language": "ja"
  }'
```

Expected response: 200 OK with recommendation JSON

### Manual Health Checks

Run daily:

1. Verify CloudWatch dashboard shows normal metrics
2. Check alarm status (no active alarms)
3. Review cost metrics (within budget)
4. Test mobile app end-to-end flow
5. Verify cache hit rate >80%

## Troubleshooting Checklist

- [ ] Check CloudWatch alarms
- [ ] Review Lambda error logs
- [ ] Verify API Gateway status
- [ ] Check Bedrock API availability
- [ ] Monitor DynamoDB throttling
- [ ] Review cache hit rate
- [ ] Check cost metrics
- [ ] Test mobile app functionality
- [ ] Verify outbreak data freshness
- [ ] Review recent deployments

## Contact Information

- **On-call Engineer**: [Your contact info]
- **AWS Support**: https://console.aws.amazon.com/support/
- **Bedrock Support**: bedrock-support@amazon.com
