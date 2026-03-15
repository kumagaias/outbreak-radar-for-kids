# Backend Lambda Functions

Lambda functions for Nova AI Recommendations API and outbreak data fetching.

## Architecture

### Nova Recommendations Lambda (`backend/`)

**Purpose**: Main API endpoint for AI-powered recommendations

**Runtime**: Node.js 22.x (Docker), 512MB, 10-15s timeout

**Trigger**: API Gateway POST `/recommendations/generate`

**Components**: DataAnonymizer, SharedCacheManager, NovaService, FallbackTemplates

**Flow**: Mobile App → API Gateway → Lambda → Cache/Bedrock Nova → Response

### Outbreak Data Fetcher Lambda (`backend/lambda/outbreak-fetcher/`)

**Purpose**: Background batch processor for outbreak data

**Runtime**: Node.js 22.x (Docker), 1024MB, 5min timeout

**Trigger**: EventBridge scheduler (weekly)

**Sources**: CDC NWSS, NHSN, FluView, FluSurv-NET (US), NIID IDWR, e-Stat (Japan)

**Flow**: EventBridge → Lambda → Parallel Fetch → Normalize → DynamoDB

## Environment Variables

### Nova Recommendations Lambda

| Variable | Description | Required |
|----------|-------------|----------|
| `DYNAMODB_SHARED_CACHE_TABLE_NAME` | Server-side cache table | Yes |
| `GUARDRAIL_ID` | Bedrock Guardrail ID | Yes |
| `GUARDRAIL_VERSION` | Guardrail version (DRAFT) | Yes |
| `ENVIRONMENT` | Environment (dev/stag/prod) | Yes |
| `AWS_REGION` | Lambda region (ap-northeast-1) | Yes |
| `BEDROCK_REGION` | Bedrock region (us-east-1) | Yes |

### Outbreak Data Fetcher Lambda

| Variable | Description | Required |
|----------|-------------|----------|
| `DYNAMODB_OUTBREAK_TABLE_NAME` | Outbreak data table | Yes |
| `TARGET_STATES` | US state codes (CA,NY,TX,FL,IL) | No |
| `FETCH_JAPAN_DATA` | Enable Japan sources (true) | No |
| `ESTAT_STATS_DATA_ID` | e-Stat dataset ID | No |
| `AWS_REGION` | Lambda region (ap-northeast-1) | Yes |

### Parameter Store

| Path | Description |
|------|-------------|
| `/prompts/v1/ja` | Japanese system prompt |
| `/prompts/v1/en` | English system prompt |
| `/estat/app-id` | e-Stat API application ID |

**Update prompts**:
```bash
aws ssm put-parameter --name /prompts/v1/ja \
  --value "$(cat prompts/system-prompt-ja.txt)" \
  --type String --overwrite --region ap-northeast-1
```

## API Endpoint

POST `/recommendations/generate`

**Request**: `ageRange`, `geographicArea`, `riskLevel`, `language`, `diseaseNames`, `outbreakData`

**Response**: `recommendation` (summary, actionItems, riskLevel, diseaseNames, generatedAt, source), `cacheHit`

## Testing

```bash
npm install
npm test                # All tests
npm run test:watch      # Watch mode
npm test -- --coverage  # With coverage
```

**Coverage Target**: 60% or higher

## Deployment

### Automated (GitHub Actions)

Triggers on push to `main`:
- Nova Lambda: Changes to `backend/**` (excluding outbreak-fetcher)
- Outbreak Lambda: Changes to `backend/lambda/outbreak-fetcher/**`

**Prerequisites**:
1. GitHub variable: `AWS_ACCOUNT_ID`
2. IAM role: `github-actions-outbreak-radar-for-kids-dev`
3. ECR repos: `nova-recommendations-dev`, `outbreak-data-fetcher-dev`

**Process**: Build Docker → Push to ECR → Update Lambda (~3-5 min)

See [.github/workflows/deploy-lambda.yml](../.github/workflows/deploy-lambda.yml)

### Manual Deployment

**Nova Recommendations Lambda**:
```bash
cd backend && npm install && npm test
export AWS_ACCOUNT_ID=<your-account-id>
docker build -t nova-recommendations:latest .
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com
docker tag nova-recommendations:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest
aws lambda update-function-code --function-name nova-recommendations-dev --image-uri ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/nova-recommendations-dev:latest --region ap-northeast-1
```

**Outbreak Data Fetcher Lambda**: Same steps in `backend/lambda/outbreak-fetcher/` with `outbreak-data-fetcher` names.

**Verify**:
```bash
aws logs tail /aws/lambda/nova-recommendations-dev --follow --region ap-northeast-1
curl -X POST https://<api-id>.execute-api.ap-northeast-1.amazonaws.com/dev/recommendations/generate -H "Content-Type: application/json" -d '{"ageRange":"2-3","geographicArea":"Tokyo","language":"ja"}'
```

### Infrastructure (Terraform)

```bash
cd infra/environments/dev && terraform init && terraform plan && terraform apply
terraform output -json > ../../../terraform-outputs.json
```

See [.kiro/steering/deployment.md](../.kiro/steering/deployment.md) for detailed procedures.

## Monitoring

**CloudWatch Logs**:
- `/aws/lambda/nova-recommendations-dev`
- `/aws/lambda/outbreak-data-fetcher-dev`

**Metrics**:
- Cache hit/miss rates
- Nova API latency
- Error rates by type
- Fallback usage frequency

## Cost Optimization

- **Nova Micro**: Low/medium risk (cost-efficient)
- **Nova Lite**: High risk with 2+ diseases (higher quality)
- **DynamoDB cache**: 1-hour TTL, on-demand billing
- **Target**: <$22/month (Nova + infrastructure)

## Security

- IAM least-privilege (Bedrock + DynamoDB only)
- Input validation (trust boundary)
- Guardrails (PII filtering)
- HTTPS only
- No PII logging

## Structure

```
backend/
├── index.js                      # Lambda handler
├── package.json
├── Dockerfile
├── lib/                          # Business logic
│   ├── nova-service.js
│   ├── data-anonymizer.js
│   ├── shared-cache-manager.js
│   └── fallback-templates.js
├── __tests__/                    # Unit tests
└── lambda/
    └── outbreak-fetcher/         # Outbreak data fetcher
        ├── src/
        │   ├── index.js          # Handler
        │   ├── sources/          # API clients
        │   ├── normalizer.js
        │   └── dynamodb-storage.js
        └── tests/
```

## Dependencies

- `@aws-sdk/client-bedrock-runtime` - Bedrock Nova API
- `@aws-sdk/client-dynamodb` - DynamoDB access
- `@aws-sdk/lib-dynamodb` - DynamoDB document client
- `jest` - Testing framework

## Related Documentation

- [Deployment Guide](../.kiro/steering/deployment.md) - Detailed deployment procedures
- [Requirements](../.kiro/specs/mvp/requirements.md) - Feature requirements
- [Design](../.kiro/specs/mvp/design.md) - Architecture and design decisions
