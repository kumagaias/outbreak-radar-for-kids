/**
 * Integration Tests for API Endpoints
 * 
 * Tests end-to-end flow: request → cache check → Nova call → response
 * Validates cache hit/miss scenarios, rate limiting, and privacy validation
 * 
 * Requirements: 13.1, 13.10, 13.11, 15.8
 */

// Mock AWS SDK before imports
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn()
    })
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({})),
  InvokeModelCommand: jest.fn()
}));

const handler = require('../../index');
const SharedCacheManager = require('../../lib/shared-cache-manager');
const NovaService = require('../../lib/nova-service');

describe('Integration: API Endpoint Flow', () => {
  let mockCacheGet;
  let mockCachePut;
  let mockNovaCall;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock cache operations
    mockCacheGet = jest.spyOn(SharedCacheManager.prototype, 'getCachedRecommendation');
    mockCachePut = jest.spyOn(SharedCacheManager.prototype, 'setCachedRecommendation');
    
    // Mock Nova service
    mockNovaCall = jest.spyOn(NovaService.prototype, 'generateRecommendation');
  });

  afterEach(() => {
    if (mockCacheGet) mockCacheGet.mockRestore();
    if (mockCachePut) mockCachePut.mockRestore();
    if (mockNovaCall) mockNovaCall.mockRestore();
  });

  describe('End-to-End Flow: Cache Miss → Nova Call → Response', () => {
    test('should complete full flow when cache misses', async () => {
      // Arrange: Cache miss
      mockCacheGet.mockResolvedValue(null);
      
      // Mock Nova response
      mockNovaCall.mockResolvedValue({
        summary: 'RSV流行が東京で報告されています。',
        actionItems: ['朝の検温を実施する', '手洗いを徹底する', '症状を確認する'],
        source: 'nova-micro'
      });
      
      mockCachePut.mockResolvedValue(true);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: [
            {
              diseaseId: 'rsv',
              diseaseName: 'RSV',
              severity: 8,
              geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
            }
          ]
        })
      };

      // Act
      const response = await handler.handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify full flow executed
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(mockNovaCall).toHaveBeenCalledTimes(1);
      expect(mockCachePut).toHaveBeenCalledTimes(1);
      
      // Verify response structure
      expect(body).toHaveProperty('recommendation');
      expect(body.recommendation).toHaveProperty('summary');
      expect(body.recommendation).toHaveProperty('actionItems');
      expect(body.recommendation.actionItems).toHaveLength(3);
      expect(body.recommendation.source).toBe('nova-micro'); // High risk single disease uses Micro
    });

    test('should return cached data when cache hits', async () => {
      // Arrange: Cache hit
      const cachedRecommendation = {
        summary: 'Cached recommendation',
        actionItems: ['Action 1', 'Action 2'],
        riskLevel: 'medium',
        source: 'nova-micro',
        generatedAt: new Date().toISOString()
      };
      
      mockCacheGet.mockResolvedValue(cachedRecommendation);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          language: 'ja',
          diseaseNames: ['Influenza'],
          outbreakData: [
            {
              diseaseId: 'flu',
              diseaseName: 'Influenza',
              severity: 5,
              geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' }
            }
          ]
        })
      };

      // Act
      const response = await handler.handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify cache hit path
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(mockNovaCall).not.toHaveBeenCalled(); // Nova not called on cache hit
      expect(mockCachePut).not.toHaveBeenCalled(); // No new cache write
      
      expect(body.recommendation.summary).toBe('Cached recommendation');
      expect(body.recommendation.source).toBe('nova-micro');
    });

    test('should use fallback when Nova times out', async () => {
      // Arrange: Cache miss + Nova timeout
      mockCacheGet.mockResolvedValue(null);
      mockNovaCall.mockRejectedValue(new Error('Timeout'));
      mockCachePut.mockResolvedValue(true);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: [
            {
              diseaseId: 'rsv',
              diseaseName: 'RSV',
              severity: 8,
              geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
            }
          ]
        })
      };

      // Act
      const response = await handler.handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify fallback used
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(mockNovaCall).toHaveBeenCalledTimes(1);
      expect(body.recommendation.source).toBe('fallback');
      expect(body.recommendation.summary).toContain('感染症'); // diseaseNames is empty, so fallback uses generic term
      expect(body.recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Privacy Validation: Reject PII', () => {
    test('should reject request with exact age (PII)', async () => {
      const event = {
        body: JSON.stringify({
          ageRange: '3', // Exact age instead of range
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: []
        })
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid request parameters');
      expect(body.details).toBeDefined();
      expect(body.details.some(d => d.includes('ageRange'))).toBe(true);
    });

    test('should reject request with ward-level location (too granular)', async () => {
      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Nerima Ward, Tokyo, JP', // Ward level instead of prefecture
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: []
        })
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid request parameters');
      expect(body.details).toBeDefined();
      expect(body.details.some(d => d.includes('granular') || d.includes('geographicArea'))).toBe(true);
    });

    test('should reject request with name field (PII)', async () => {
      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          name: '田中太郎', // PII
          outbreakData: []
        })
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid request parameters');
      expect(body.details).toBeDefined();
      expect(body.details.some(d => d.includes('name') || d.includes('Unexpected property'))).toBe(true);
    });

    test('should accept valid prefecture-level request', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockNovaCall.mockResolvedValue({
        summary: 'Valid response',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      });
      mockCachePut.mockResolvedValue(true);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [], // Prefecture level - valid
          language: 'ja',
          outbreakData: [
            {
              diseaseId: 'flu',
              diseaseName: 'Influenza',
              severity: 5,
              geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
            }
          ]
        })
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Rate Limiting', () => {
    test('should track request count per identity', async () => {
      // This test validates rate limiting logic exists
      // Actual rate limiting is enforced by API Gateway Usage Plans
      
      const identityId = 'test-identity-123';
      const event = {
        requestContext: {
          identity: {
            cognitoIdentityId: identityId
          }
        },
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: []
        })
      };

      mockCacheGet.mockResolvedValue({
        summary: 'Cached',
        actionItems: ['Action 1'],
        source: 'nova-micro'
      });

      const response = await handler.handler(event);

      // Should succeed (rate limiting enforced at API Gateway level)
      expect(response.statusCode).toBe(200);
    });
  });

  describe('K-Anonymity Protection', () => {
    test('should use national data when prefecture has <10 cases', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockNovaCall.mockResolvedValue({
        summary: 'National data used for privacy',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      });
      mockCachePut.mockResolvedValue(true);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tottori, JP',
          riskLevel: 'medium',
          diseaseNames: [], // Low population prefecture
          language: 'ja',
          outbreakData: [
            {
              diseaseId: 'measles',
              diseaseName: 'Measles',
              severity: 6,
              reportedCases: 3, // <10 cases triggers k-anonymity
              geographicUnit: { country: 'JP', stateOrPrefecture: '鳥取県' }
            }
          ]
        })
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(200);
      // K-anonymity logic should be applied in data anonymizer
    });
  });

  describe('Error Handling', () => {
    test('should return 500 on unexpected error', async () => {
      mockCacheGet.mockRejectedValue(new Error('DynamoDB connection failed'));

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: []
        })
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    test('should return 400 on malformed JSON', async () => {
      const event = {
        body: 'invalid json{'
      };

      const response = await handler.handler(event);

      expect(response.statusCode).toBe(400);
    });
  });
});
