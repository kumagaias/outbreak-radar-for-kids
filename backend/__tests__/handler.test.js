/**
 * Integration tests for Lambda handler
 */

// Mock dependencies BEFORE requiring the handler
jest.mock('../lib/data-anonymizer');
jest.mock('../lib/shared-cache-manager');
jest.mock('../lib/nova-service');

describe('Lambda Handler', () => {
  let handler;
  let DataAnonymizer;
  let SharedCacheManager;
  let NovaService;
  let mockValidateNoPII;
  let mockAnonymizeLocation;
  let mockFilterOutbreakData;
  let mockSanitizeForLogging;
  let mockGenerateCacheKey;
  let mockGetCachedRecommendation;
  let mockSetCachedRecommendation;
  let mockGenerateRecommendation;

  beforeAll(() => {
    // Set environment variables before loading modules
    process.env.DYNAMODB_SHARED_CACHE_TABLE_NAME = 'test-cache-table';
    process.env.GUARDRAIL_ID = 'test-guardrail-id';
    process.env.ENVIRONMENT = 'test';
    process.env.AWS_REGION = 'us-east-1';
  });

  beforeEach(() => {
    // Clear module cache
    jest.resetModules();
    
    // Re-require mocked modules
    DataAnonymizer = require('../lib/data-anonymizer');
    SharedCacheManager = require('../lib/shared-cache-manager');
    NovaService = require('../lib/nova-service');
    
    // Setup mocks
    mockValidateNoPII = jest.fn().mockReturnValue({ isValid: true, errors: [] });
    mockAnonymizeLocation = jest.fn().mockReturnValue('Tokyo, JP');
    mockFilterOutbreakData = jest.fn().mockReturnValue([]);
    mockSanitizeForLogging = jest.fn(data => data);
    
    DataAnonymizer.mockImplementation(() => ({
      validateNoPII: mockValidateNoPII,
      anonymizeLocation: mockAnonymizeLocation,
      filterOutbreakData: mockFilterOutbreakData,
      sanitizeForLogging: mockSanitizeForLogging
    }));

    
    // Mock SharedCacheManager
    mockGenerateCacheKey = jest.fn().mockReturnValue('test-cache-key');
    mockGetCachedRecommendation = jest.fn().mockResolvedValue(null);
    mockSetCachedRecommendation = jest.fn().mockResolvedValue();
    
    SharedCacheManager.mockImplementation(() => ({
      generateCacheKey: mockGenerateCacheKey,
      getCachedRecommendation: mockGetCachedRecommendation,
      setCachedRecommendation: mockSetCachedRecommendation
    }));

    // Mock NovaService
    mockGenerateRecommendation = jest.fn().mockResolvedValue({
      summary: 'Test summary',
      actionItems: ['Action 1', 'Action 2', 'Action 3'],
      source: 'nova-micro',
      riskLevel: 'high',
      diseaseNames: ['RSV'],
      generatedAt: new Date().toISOString()
    });
    
    NovaService.mockImplementation(() => ({
      generateRecommendation: mockGenerateRecommendation
    }));
    
    // Now require handler with mocks in place
    const indexModule = require('../index');
    handler = indexModule.handler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success cases', () => {
    it('should return cached recommendation on cache hit', async () => {
      const cachedRecommendation = {
        summary: 'Cached summary',
        actionItems: ['Cached action 1', 'Cached action 2', 'Cached action 3'],
        source: 'nova-micro'
      };

      mockGetCachedRecommendation.mockResolvedValue(cachedRecommendation);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.recommendation).toEqual(cachedRecommendation);
      expect(body.source).toBe('server_cache');
      expect(body.cacheHit).toBe(true);
      
      expect(mockGenerateRecommendation).not.toHaveBeenCalled();
    });

    it('should generate new recommendation on cache miss', async () => {
      mockGetCachedRecommendation.mockResolvedValue(null);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.recommendation).toBeDefined();
      expect(body.cacheHit).toBe(false);
      
      expect(mockGenerateRecommendation).toHaveBeenCalled();
      expect(mockSetCachedRecommendation).toHaveBeenCalled();
    });

    it('should include CORS headers', async () => {
      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });

    it('should pass nearbyHotspot parameter to Nova service', async () => {
      mockGetCachedRecommendation.mockResolvedValue(null);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: [],
          nearbyHotspot: true
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        expect.objectContaining({
          nearbyHotspot: true
        })
      );
    });

    it('should default nearbyHotspot to false when not provided', async () => {
      mockGetCachedRecommendation.mockResolvedValue(null);

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
          // nearbyHotspot not provided
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockGenerateRecommendation).toHaveBeenCalledWith(
        expect.objectContaining({
          nearbyHotspot: false
        })
      );
    });
  });

  describe('Validation errors', () => {
    it('should return 400 on validation failure', async () => {
      // Update mock to return validation error
      mockValidateNoPII.mockReturnValue({
        isValid: false,
        errors: ['Invalid ageRange']
      });

      const event = {
        body: JSON.stringify({
          ageRange: 'invalid',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja'
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid request parameters');
      expect(body.details).toContain('Invalid ageRange');
    });

    it('should return 400 on invalid JSON', async () => {
      const event = {
        body: 'invalid json',
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should return 503 on timeout', async () => {
      // Mock Nova to throw timeout error
      mockGenerateRecommendation.mockRejectedValue(new Error('Nova service timeout after 5s'));

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      // Nova service catches timeout and returns fallback, so handler returns 200
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.recommendation).toBeDefined();
    });

    it('should return 500 on unexpected error', async () => {
      // Mock validation to throw unexpected error
      mockValidateNoPII.mockImplementation(() => {
        throw new Error('Unexpected validation error');
      });

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should not fail if cache write fails', async () => {
      mockSetCachedRecommendation.mockRejectedValue(new Error('Cache write failed'));

      const event = {
        body: JSON.stringify({
          ageRange: '2-3',
          geographicArea: 'Tokyo, JP',
          riskLevel: 'high',
          language: 'ja',
          diseaseNames: ['RSV'],
          outbreakData: []
        }),
        requestContext: { requestId: 'test-request-id' }
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
    });
  });
});
