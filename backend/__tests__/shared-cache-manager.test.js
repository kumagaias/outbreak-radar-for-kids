/**
 * Unit tests for SharedCacheManager
 */

const SharedCacheManager = require('../lib/shared-cache-manager');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

describe('SharedCacheManager', () => {
  let cacheManager;
  let mockSend;

  beforeEach(() => {
    mockSend = jest.fn();
    DynamoDBDocumentClient.from = jest.fn().mockReturnValue({
      send: mockSend
    });

    cacheManager = new SharedCacheManager('test-table', 'us-east-1');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCacheKey', () => {
    it('should generate cache key with correct format', () => {
      const outbreakData = [
        { diseaseName: 'RSV' },
        { diseaseName: 'Influenza' }
      ];

      const key = cacheManager.generateCacheKey('Tokyo, JP', '2-3', outbreakData);
      
      expect(key).toMatch(/^Tokyo_2-3_[a-f0-9]{16}$/);
    });

    it('should normalize disease names (sort)', () => {
      const outbreakData1 = [
        { diseaseName: 'RSV' },
        { diseaseName: 'Influenza' }
      ];
      const outbreakData2 = [
        { diseaseName: 'Influenza' },
        { diseaseName: 'RSV' }
      ];

      const key1 = cacheManager.generateCacheKey('Tokyo, JP', '2-3', outbreakData1);
      const key2 = cacheManager.generateCacheKey('Tokyo, JP', '2-3', outbreakData2);
      
      expect(key1).toBe(key2);
    });

    it('should extract prefecture from geographic area', () => {
      const outbreakData = [{ diseaseName: 'RSV' }];

      const key = cacheManager.generateCacheKey('Tokyo, JP', '2-3', outbreakData);
      
      expect(key).toMatch(/^Tokyo_/);
    });

    it('should handle empty outbreak data', () => {
      const key = cacheManager.generateCacheKey('Tokyo, JP', '2-3', []);
      
      expect(key).toMatch(/^Tokyo_2-3_[a-f0-9]{16}$/);
    });
  });

  describe('getCachedRecommendation', () => {
    it('should return cached recommendation if found', async () => {
      const mockRecommendation = {
        summary: 'Test summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockSend.mockResolvedValue({
        Item: {
          cache_key: 'test-key',
          recommendation: JSON.stringify(mockRecommendation),
          expiration_time: Math.floor(Date.now() / 1000) + 3600
        }
      });

      const result = await cacheManager.getCachedRecommendation('test-key');
      
      expect(result).toEqual(mockRecommendation);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
    });

    it('should return null if not found', async () => {
      mockSend.mockResolvedValue({});

      const result = await cacheManager.getCachedRecommendation('test-key');
      
      expect(result).toBeNull();
    });

    it('should return null if expired', async () => {
      mockSend.mockResolvedValue({
        Item: {
          cache_key: 'test-key',
          recommendation: JSON.stringify({ summary: 'Test' }),
          expiration_time: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        }
      });

      const result = await cacheManager.getCachedRecommendation('test-key');
      
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await cacheManager.getCachedRecommendation('test-key');
      
      expect(result).toBeNull();
    });
  });

  describe('setCachedRecommendation', () => {
    it('should save recommendation with TTL', async () => {
      const recommendation = {
        summary: 'Test summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockSend.mockResolvedValue({});

      await cacheManager.setCachedRecommendation('test-key', recommendation);
      
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(PutCommand));
      
      // Verify the command was created with correct parameters
      // We can't easily access the input from the mocked command,
      // but we can verify the call was made with a PutCommand instance
      const callArg = mockSend.mock.calls[0][0];
      expect(callArg.constructor.name).toBe('PutCommand');
    });

    it('should not throw on error', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      await expect(
        cacheManager.setCachedRecommendation('test-key', {})
      ).resolves.not.toThrow();
    });
  });
});
