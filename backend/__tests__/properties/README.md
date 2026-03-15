# Property-Based Tests for Backend Lambda

This directory contains property-based tests (PBT) for the Nova AI Recommendations backend Lambda function. Tests are organized into three categories based on execution frequency and importance.

## Test Categories

### Critical Tests (`critical.properties.test.js`)
**Run frequency**: Every commit (~55s)

Tests critical invariants that must hold for all inputs:
- **PII Detection**: Validates that requests with granular location data (ward/county) are rejected
- **Geographic Anonymization**: Ensures location data is always anonymized to prefecture/state level
- **Cache Key Uniqueness**: Verifies cache keys are collision-resistant and deterministic

**Properties tested**: 15 properties
- 6 PII detection properties
- 3 geographic anonymization properties
- 6 cache key uniqueness properties

### Standard Tests (`standard.properties.test.js`)
**Run frequency**: Daily (~30s)

Tests business logic invariants:
- **Model Selection Logic**: Validates Nova Lite vs Micro selection based on risk level and outbreak complexity
- **Fallback Consistency**: Ensures fallback recommendations have consistent structure and content
- **Severity Threshold Transitions**: Verifies severity-based logic transitions correctly at thresholds (4, 7)

**Properties tested**: 14 properties
- 6 model selection properties
- 5 fallback consistency properties
- 3 severity threshold properties

### Extended Tests (`extended.properties.test.js`)
**Run frequency**: Pre-deploy (~85s)

Tests content quality and cultural appropriateness:
- **Tone Validation**: Ensures no alarmist language or medical diagnosis phrases
- **Cultural Appropriateness (Japanese)**: Validates 37.5°C fever threshold, polite form, MHLW guidelines
- **Cultural Appropriateness (English)**: Validates 99.5°F/100.4°F thresholds, declarative sentences
- **Action Item Age-Appropriateness**: Ensures no infant-inappropriate instructions (e.g., "gargle")
- **Temperature Threshold Validation**: Verifies temperature values are within physiologically valid ranges

**Properties tested**: 18 properties
- 4 tone validation properties
- 4 Japanese cultural appropriateness properties
- 3 English cultural appropriateness properties
- 4 age-appropriateness properties
- 2 temperature validation properties
- 1 hygiene action property

## Running Tests

### Run all PBT tests
```bash
./run-pbt.sh
```

### Run specific category
```bash
# Critical tests only
npm test -- __tests__/properties/critical.properties.test.js

# Standard tests only
npm test -- __tests__/properties/standard.properties.test.js

# Extended tests only
npm test -- __tests__/properties/extended.properties.test.js
```

### Run specific test
```bash
npm test -- __tests__/properties/critical.properties.test.js --testNamePattern="PII Detection"
```

## Test Configuration

All tests use the following configuration:
- **Iterations per property**: 100 (configurable via `PBT_CONFIG.numRuns`)
- **Verbose mode**: Disabled by default (set `PBT_CONFIG.verbose = true` for debugging)

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/pbt-tests.yml
name: Property-Based Tests

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
  pull_request:
    branches: [main]
    paths:
      - 'backend/**'
  schedule:
    # Run daily at 00:00 UTC
    - cron: '0 0 * * *'

jobs:
  critical-tests:
    name: Critical PBT (every commit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd backend && npm ci
      - run: cd backend && npm test -- __tests__/properties/critical.properties.test.js

  standard-tests:
    name: Standard PBT (daily)
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule' || github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd backend && npm ci
      - run: cd backend && npm test -- __tests__/properties/standard.properties.test.js

  extended-tests:
    name: Extended PBT (pre-deploy)
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd backend && npm ci
      - run: cd backend && npm test -- __tests__/properties/extended.properties.test.js
```

## Mocking Strategy

**IMPORTANT**: All PBT tests use mocks for external services to avoid costs and execution time:

- **NovaService**: Mocked to avoid Bedrock API calls (would cost $$$ and take minutes)
- **DynamoDB**: Mocked to avoid AWS service calls
- **Validation logic**: Tested with mocks, validates logic correctness
- **API integration**: Validated separately with smoke tests (1-2 real API calls)

### Smoke Tests (Separate)

Create `backend/__tests__/smoke/` directory for integration tests:
- 1-2 real Bedrock API calls to validate actual integration
- Run manually or in staging environment only
- Not part of regular CI/CD pipeline

## Requirements Validation

These tests validate the following requirements:

### Critical Tests
- **Requirement 5.3**: Backend API validates input parameters before calling Nova API
- **Requirement 5.9**: Backend API enforces k-anonymity protection
- **Requirement 5.11**: Backend API acts as trust boundary
- **Requirement 13.6**: Backend API validates input parameters
- **Requirement 13.7**: Backend API rejects requests containing PII
- **Requirement 16.6**: Backend API implements DynamoDB caching with key format

### Standard Tests
- **Requirement 16.1**: Backend API uses Nova Micro for low-risk scenarios
- **Requirement 16.2**: Backend API uses Nova Micro for medium-risk scenarios
- **Requirement 16.3**: Backend API uses Nova Lite for high-risk scenarios
- **Requirement 16.4**: Backend API uses Nova Micro for high-risk single disease
- **Requirement 7.1**: System uses fallback recommendations when Nova fails
- **Requirement 7.2**: System logs service failures
- **Requirement 7.5**: System provides same risk level calculation in fallback mode

### Extended Tests
- **Requirement 3.4**: Nova Service uses system prompt that enforces non-alarmist tone
- **Requirement 3.5**: Nova Service uses system prompt that prohibits medical diagnosis
- **Requirement 2.1**: Recommendation Generator produces infant-specific guidance
- **Requirement 2.2**: Recommendation Generator produces toddler-specific guidance
- **Requirement 2.3**: Recommendation Generator produces preschool-specific guidance
- **Requirement 2.4**: Recommendation Generator produces school-age-specific guidance
- **Requirement 4.5**: Recommendation Generator includes guidance considering Japanese daycare standards
- **Requirement 4.6**: Recommendation Generator includes guidance on caution below 37.5°C
- **Requirement 4.7**: Recommendation Generator includes diarrhea/vomiting frequency standards
- **Requirement 8.3**: Recommendation Generator uses polite form (desu/masu) for Japanese
- **Requirement 8.4**: Recommendation Generator uses declarative sentences for English

## Troubleshooting

### Test Failures

If a property test fails, fast-check will provide:
1. **Counterexample**: The specific input that caused the failure
2. **Shrunk value**: The minimal input that reproduces the failure
3. **Seed**: Random seed for reproducing the exact test run

Example:
```
Property failed after 1 tests
{ seed: -161261054, path: "0:0:0:1:0", endOnFailure: true }
Counterexample: ["Tokyo, JP","0-1",4,5]
Shrunk 4 time(s)
```

To reproduce:
```javascript
fc.assert(
  fc.property(...),
  { seed: -161261054, path: "0:0:0:1:0" }
);
```

### Performance Issues

If tests are slow:
1. Reduce `numRuns` in `PBT_CONFIG` (default: 100)
2. Use `--maxWorkers=1` flag for Jest
3. Run specific test categories instead of all tests

### Debugging

Enable verbose mode to see all generated values:
```javascript
const PBT_CONFIG = {
  numRuns: 100,
  verbose: true // Enable verbose output
};
```

## References

- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [Design Document: PBT Testing Strategy](.kiro/specs/mvp/design.md#pbtテスト実行戦略)
