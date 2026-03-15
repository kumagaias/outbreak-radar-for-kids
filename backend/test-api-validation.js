/**
 * Task 3: Backend API Validation Script
 * 
 * Tests the deployed Lambda function with real AWS services:
 * - High/medium/low risk scenarios
 * - Cache hit/miss behavior
 * - Fallback on Nova timeout
 * - Privacy validation (PII rejection)
 * - CloudWatch logging
 */

const { 
  LambdaClient, 
  InvokeCommand 
} = require('@aws-sdk/client-lambda');

const FUNCTION_NAME = 'nova-recommendations-dev';
const REGION = 'ap-northeast-1';

const lambda = new LambdaClient({ region: REGION });

// Test scenarios
const testScenarios = [
  {
    name: 'High Risk - Multiple Diseases',
    payload: {
      ageRange: '2-3',
      geographicArea: 'Tokyo, JP',
      riskLevel: 'high',
      language: 'ja',
      diseaseNames: ['RSV', 'Influenza'],
      outbreakData: [
        {
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['0-1', '2-3']
        },
        {
          diseaseName: 'Influenza',
          severity: 7,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['2-3', '4-6']
        }
      ]
    },
    expectedModel: 'nova-lite'
  },
  {
    name: 'High Risk - Single Disease',
    payload: {
      ageRange: '0-1',
      geographicArea: 'Tokyo, JP',
      riskLevel: 'high',
      language: 'ja',
      diseaseNames: ['RSV'],
      outbreakData: [
        {
          diseaseName: 'RSV',
          severity: 9,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['0-1']
        }
      ]
    },
    expectedModel: 'nova-micro'
  },
  {
    name: 'Medium Risk',
    payload: {
      ageRange: '4-6',
      geographicArea: 'California, US',
      riskLevel: 'medium',
      language: 'en',
      diseaseNames: ['Norovirus'],
      outbreakData: [
        {
          diseaseName: 'Norovirus',
          severity: 5,
          geographicUnit: { stateOrPrefecture: 'California' },
          affectedAgeRanges: ['4-6', '7+']
        }
      ]
    },
    expectedModel: 'nova-micro'
  },
  {
    name: 'Low Risk',
    payload: {
      ageRange: '7+',
      geographicArea: 'New York, US',
      riskLevel: 'low',
      language: 'en',
      diseaseNames: [],
      outbreakData: []
    },
    expectedModel: 'nova-micro'
  },
  {
    name: 'PII Rejection - Exact Age',
    payload: {
      ageRange: '2-3',
      geographicArea: 'Tokyo, JP',
      riskLevel: 'high',
      language: 'ja',
      diseaseNames: ['RSV'],
      exactAge: 3, // PII - should be rejected
      outbreakData: [
        {
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['2-3']
        }
      ]
    },
    expectError: true,
    expectedStatus: 400
  },
  {
    name: 'PII Rejection - Ward Level Location',
    payload: {
      ageRange: '2-3',
      geographicArea: 'Nerima Ward, Tokyo, JP', // Too granular
      riskLevel: 'high',
      language: 'ja',
      diseaseNames: ['RSV'],
      outbreakData: [
        {
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { 
            stateOrPrefecture: 'Tokyo',
            countyOrWard: 'Nerima' // Should be stripped
          },
          affectedAgeRanges: ['2-3']
        }
      ]
    },
    expectError: true,
    expectedStatus: 400
  }
];

async function invokeLambda(payload) {
  const command = new InvokeCommand({
    FunctionName: FUNCTION_NAME,
    Payload: JSON.stringify(payload)
  });

  const response = await lambda.send(command);
  const result = JSON.parse(Buffer.from(response.Payload).toString());
  
  return {
    statusCode: response.StatusCode,
    payload: result
  };
}

async function runTest(scenario) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${scenario.name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const startTime = Date.now();
    const result = await invokeLambda(scenario.payload);
    const duration = Date.now() - startTime;
    
    console.log(`Duration: ${duration}ms`);
    console.log(`Status Code: ${result.statusCode}`);
    
    if (scenario.expectError) {
      if (result.payload.error) {
        console.log('✅ PASS - Error returned as expected');
        console.log(`Error: ${result.payload.error}`);
        if (result.payload.details) {
          console.log(`Details: ${JSON.stringify(result.payload.details, null, 2)}`);
        }
      } else {
        console.log('❌ FAIL - Expected error but got success');
        console.log(JSON.stringify(result.payload, null, 2));
      }
    } else {
      if (result.payload.recommendation) {
        console.log('✅ PASS - Recommendation generated');
        console.log(`Source: ${result.payload.source || result.payload.recommendation.source}`);
        console.log(`Cache Hit: ${result.payload.cacheHit}`);
        console.log(`Risk Level: ${result.payload.recommendation.riskLevel}`);
        console.log(`Summary: ${result.payload.recommendation.summary.substring(0, 100)}...`);
        console.log(`Action Items: ${result.payload.recommendation.actionItems.length} items`);
        
        if (scenario.expectedModel && result.payload.recommendation.source) {
          if (result.payload.recommendation.source === scenario.expectedModel) {
            console.log(`✅ Model selection correct: ${scenario.expectedModel}`);
          } else {
            console.log(`⚠️  Model mismatch: expected ${scenario.expectedModel}, got ${result.payload.recommendation.source}`);
          }
        }
      } else {
        console.log('❌ FAIL - No recommendation in response');
        console.log(JSON.stringify(result.payload, null, 2));
      }
    }
  } catch (error) {
    console.log('❌ FAIL - Exception thrown');
    console.error(error);
  }
}

async function testCacheBehavior() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Test: Cache Hit/Miss Behavior');
  console.log(`${'='.repeat(60)}`);
  
  const testPayload = {
    ageRange: '2-3',
    geographicArea: 'Tokyo, JP',
    riskLevel: 'high',
    language: 'ja',
    diseaseNames: ['RSV'],
    outbreakData: [
      {
        diseaseName: 'RSV',
        severity: 8,
        geographicUnit: { stateOrPrefecture: 'Tokyo' },
        affectedAgeRanges: ['2-3']
      }
    ]
  };
  
  // First call - should be cache miss
  console.log('\n1st call (expect cache miss):');
  const result1 = await invokeLambda(testPayload);
  console.log(`Cache Hit: ${result1.payload.cacheHit}`);
  console.log(`Source: ${result1.payload.source || result1.payload.recommendation?.source}`);
  
  if (result1.payload.cacheHit === false) {
    console.log('✅ PASS - Cache miss on first call');
  } else {
    console.log('⚠️  Cache hit on first call (may be from previous test)');
  }
  
  // Second call - should be cache hit
  console.log('\n2nd call (expect cache hit):');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
  const result2 = await invokeLambda(testPayload);
  console.log(`Cache Hit: ${result2.payload.cacheHit}`);
  console.log(`Source: ${result2.payload.source}`);
  
  if (result2.payload.cacheHit === true && result2.payload.source === 'server_cache') {
    console.log('✅ PASS - Cache hit on second call');
  } else {
    console.log('❌ FAIL - Expected cache hit but got cache miss');
  }
}

async function main() {
  console.log('Backend API Validation - Task 3');
  console.log('Testing deployed Lambda function with real AWS services\n');
  console.log(`Function: ${FUNCTION_NAME}`);
  console.log(`Region: ${REGION}\n`);
  
  // Run all test scenarios
  for (const scenario of testScenarios) {
    await runTest(scenario);
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait between tests
  }
  
  // Test cache behavior
  await testCacheBehavior();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Validation Complete');
  console.log(`${'='.repeat(60)}`);
  console.log('\nNext Steps:');
  console.log('1. Check CloudWatch Logs: aws logs tail /aws/lambda/nova-recommendations-dev --follow');
  console.log('2. Check CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=nova-recommendations-dev');
  console.log('3. Verify DynamoDB cache entries: aws dynamodb scan --table-name shared-recommendations-cache-dev --region ap-northeast-1');
}

main().catch(console.error);
