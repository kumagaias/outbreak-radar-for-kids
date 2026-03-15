/**
 * Performance Validation Tests
 * 
 * Validates performance targets:
 * - Risk calculation completes within 3 seconds
 * - Recommendation generation completes within 5 seconds
 * - Cached recommendations display within 3 seconds
 * - Low risk display within 10 seconds
 * 
 * Requirements: 1.1, 2.7, 9.1, 9.8
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

describe('Performance Validation', () => {
  let mockCacheGet;
  let mockCachePut;
  let mockNovaCall;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet = jest.spyOn(SharedCacheManager.prototype, 'getCachedRecommendation');
    mockCachePut = jest.spyOn(SharedCacheManager.prototype, 'setCachedRecommendation');
    mockNovaCall = jest.spyOn(NovaService.prototype, 'generateRecommendation');
  });

  afterEach(() => {
    if (mockCacheGet) mockCacheGet.mockRestore();
    if (mockCachePut) mockCachePut.mockRestore();
    if (mockNovaCall) mockNovaCall.mockRestore();
  });

  describe('Cached Recommendations Performance', () => {
    test('should return cached recommendation within 3 seconds', async () => {
      // Arrange: Cache hit
      const cachedRecommendation = {
        summary: 'Cached recommendation',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
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
          diseaseNames: [],
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

      // Act
      const startTime = Date.now();
      const response = await handler.handler(event);
      const duration = Date.now() - startTime;

      // Assert
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(3000); // 3 seconds
      
      console.log(`✓ Cached recommendation returned in ${duration}ms (target: <3000ms)`);
    });

    test('should handle cache lookup efficiently', async () => {
      mockCacheGet.mockResolvedValue({
        summary: 'Fast cache',
        actionItems: ['Action 1'],
        source: 'nova-micro'
      });

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

      const startTime = Date.now();
      await handler.handler(event);
      const duration = Date.now() - startTime;

      // Cache lookup should be very fast (<500ms)
      expect(duration).toBeLessThan(500);
      
      console.log(`✓ Cache lookup completed in ${duration}ms (target: <500ms)`);
    });
  });

  describe('Nova API Call Performance', () => {
    test('should complete Nova call within 5 seconds', async () => {
      // Arrange: Cache miss
      mockCacheGet.mockResolvedValue(null);
      
      // Simulate Nova API latency (2-3 seconds typical)
      mockNovaCall.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              summary: 'AI-generated recommendation',
              actionItems: ['Action 1', 'Action 2', 'Action 3']
            });
          }, 2500); // 2.5 second latency
        });
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
      const startTime = Date.now();
      const response = await handler.handler(event);
      const duration = Date.now() - startTime;

      // Assert
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      console.log(`✓ Nova API call completed in ${duration}ms (target: <5000ms)`);
    }, 10000); // Increase Jest timeout for this test

    test('should timeout Nova call after 5 seconds and use fallback', async () => {
      // Arrange: Cache miss + Nova timeout
      mockCacheGet.mockResolvedValue(null);
      
      // Simulate Nova timeout error
      mockNovaCall.mockRejectedValue(new Error('Nova service timeout after 5s'));
      
      mockCachePut.mockResolvedValue(true);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          diseaseNames: ['RSV'],
          language: 'ja',
          outbreakData: [
            {
              diseaseId: 'rsv',
              diseaseName: 'RSV',
              severity: 8,
              geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' }
            }
          ]
        })
      };

      // Act
      const startTime = Date.now();
      const response = await handler.handler(event);
      const duration = Date.now() - startTime;

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should use fallback due to timeout
      expect(body.recommendation.source).toBe('fallback');
      expect(body.recommendation.summary).toBeDefined();
      expect(body.recommendation.actionItems).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should be fast (no actual timeout wait)
      
      console.log(`✓ Timeout handled in ${duration}ms, fallback used`);
    });
  });

  describe('Low Risk Scenario Performance', () => {
    test('should display low risk recommendation within 10 seconds', async () => {
      // Arrange: Low risk scenario
      mockCacheGet.mockResolvedValue(null);
      
      mockNovaCall.mockResolvedValue({
        summary: '現在、東京都では大きな感染症の流行は報告されていません。',
        actionItems: [
          '日常的な手洗いを継続する',
          '規則正しい生活リズムを維持する'
        ]
      });
      
      mockCachePut.mockResolvedValue(true);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          diseaseNames: [],
          language: 'ja',
          outbreakData: [] // No outbreaks = low risk
        })
      };

      // Act
      const startTime = Date.now();
      const response = await handler.handler(event);
      const duration = Date.now() - startTime;

      // Assert
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(10000); // 10 seconds
      
      const body = JSON.parse(response.body);
      expect(body.recommendation.actionItems.length).toBeGreaterThanOrEqual(2);
      
      console.log(`✓ Low risk recommendation displayed in ${duration}ms (target: <10000ms)`);
    });
  });

  describe('Cache Key Generation Performance', () => {
    test('should generate cache key quickly', () => {
      const cacheManager = new SharedCacheManager();
      
      const outbreakData = [
        {
          diseaseId: 'flu',
          diseaseName: 'Influenza',
          severity: 5.234,
          geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
        },
        {
          diseaseId: 'rsv',
          diseaseName: 'RSV',
          severity: 7.891,
          geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
        }
      ];

      const startTime = Date.now();
      const cacheKey = cacheManager.generateCacheKey('東京都', '2-3', outbreakData);
      const duration = Date.now() - startTime;

      expect(cacheKey).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be very fast (<100ms)
      
      console.log(`✓ Cache key generated in ${duration}ms (target: <100ms)`);
    });
  });

  describe('Fallback Template Performance', () => {
    test('should generate fallback recommendation quickly', async () => {
      // Arrange: Force fallback by cache miss + Nova error
      mockCacheGet.mockResolvedValue(null);
      mockNovaCall.mockRejectedValue(new Error('Nova unavailable'));
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
              diseaseId: 'flu',
              diseaseName: 'Influenza',
              severity: 6,
              geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
            }
          ]
        })
      };

      // Act
      const startTime = Date.now();
      const response = await handler.handler(event);
      const duration = Date.now() - startTime;

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.recommendation.source).toBe('fallback');
      
      // Fallback should be instant (<1 second)
      expect(duration).toBeLessThan(1000);
      
      console.log(`✓ Fallback recommendation generated in ${duration}ms (target: <1000ms)`);
    });
  });

  describe('Concurrent Request Performance', () => {
    test('should handle multiple concurrent requests efficiently', async () => {
      mockCacheGet.mockResolvedValue({
        summary: 'Cached',
        actionItems: ['Action 1'],
        source: 'nova-micro'
      });

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

      // Act: Send 10 concurrent requests
      const startTime = Date.now();
      const promises = Array(10).fill(null).map(() => handler.handler(event));
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
      
      // All 10 requests should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
      
      console.log(`✓ 10 concurrent requests completed in ${duration}ms (target: <5000ms)`);
    });
  });

  describe('Memory Efficiency', () => {
    test('should not leak memory on repeated calls', async () => {
      mockCacheGet.mockResolvedValue({
        summary: 'Cached',
        actionItems: ['Action 1'],
        source: 'nova-micro'
      });

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

      const initialMemory = process.memoryUsage().heapUsed;

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await handler.handler(event);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be minimal (<50MB for 100 requests)
      expect(memoryIncrease).toBeLessThan(50);
      
      console.log(`✓ Memory increase after 100 requests: ${memoryIncrease.toFixed(2)}MB (target: <50MB)`);
    });
  });
});
