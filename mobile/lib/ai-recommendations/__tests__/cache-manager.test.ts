/**
 * Unit tests for Cache Manager
 * 
 * Tests specific scenarios:
 * - Cache hit returns data within 3 seconds
 * - Cache miss returns null
 * - Cache expiration after 24 hours (isStale = true)
 * - Cache invalidation when outbreak data timestamp changes
 * - Cache key generation (same key for same ageRange + prefecture)
 */

import { CacheManager } from '../cache-manager';
import {
  ChildProfile,
  Recommendation,
  RiskLevel,
  AgeRange,
  Language
} from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  const testChildProfile: ChildProfile = {
    ageRange: AgeRange.TODDLER,
    location: {
      country: 'JP',
      stateOrPrefecture: 'Tokyo',
      countyOrWard: 'Nerima'
    }
  };

  const testRecommendation: Recommendation = {
    id: 'test-rec-001',
    summary: 'Test recommendation summary',
    actionItems: [
      { id: '1', text: 'Action 1', category: 'hygiene', priority: 1 },
      { id: '2', text: 'Action 2', category: 'monitoring', priority: 2 },
      { id: '3', text: 'Action 3', category: 'attendance', priority: 3 }
    ],
    riskLevel: RiskLevel.MEDIUM,
    diseaseNames: ['RSV', 'Influenza'],
    generatedAt: new Date('2024-01-15T10:00:00Z'),
    outbreakDataTimestamp: new Date('2024-01-15T09:00:00Z'),
    source: 'nova-micro',
    childAgeRange: AgeRange.TODDLER,
    geographicArea: 'Tokyo, JP',
    language: Language.JAPANESE
  };

  beforeEach(() => {
    cacheManager = new CacheManager();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Cache Hit', () => {
    it('should return cached data within 3 seconds', async () => {
      const cacheData = {
        recommendation: testRecommendation,
        timestamp: Date.now() - 1000, // 1 second ago
        outbreakDataTimestamp: testRecommendation.outbreakDataTimestamp.getTime(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

      const startTime = Date.now();
      const cached = await cacheManager.getCachedRecommendation(testChildProfile);
      const endTime = Date.now();
      const retrievalTime = endTime - startTime;

      expect(retrievalTime).toBeLessThan(3000);
      expect(cached).not.toBeNull();
      expect(cached?.recommendation.id).toBe(testRecommendation.id);
      expect(cached?.recommendation.summary).toBe(testRecommendation.summary);
      expect(cached?.isStale).toBe(false);
    });

    it('should return cached data with correct age', async () => {
      const cacheTimestamp = Date.now() - 5000; // 5 seconds ago
      const cacheData = {
        recommendation: testRecommendation,
        timestamp: cacheTimestamp,
        outbreakDataTimestamp: testRecommendation.outbreakDataTimestamp.getTime(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

      const cached = await cacheManager.getCachedRecommendation(testChildProfile);

      expect(cached).not.toBeNull();
      expect(cached?.age).toBeGreaterThanOrEqual(5000);
      expect(cached?.age).toBeLessThan(6000); // Allow some margin
    });
  });

  describe('Cache Miss', () => {
    it('should return null when cache is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const cached = await cacheManager.getCachedRecommendation(testChildProfile);

      expect(cached).toBeNull();
    });

    it('should return null on AsyncStorage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const cached = await cacheManager.getCachedRecommendation(testChildProfile);

      expect(cached).toBeNull();
    });
  });

  describe('Cache Expiration', () => {
    it('should mark cache as stale after 24 hours', async () => {
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const cacheData = {
        recommendation: testRecommendation,
        timestamp: twentyFiveHoursAgo,
        outbreakDataTimestamp: testRecommendation.outbreakDataTimestamp.getTime(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

      const cached = await cacheManager.getCachedRecommendation(testChildProfile);

      expect(cached).not.toBeNull();
      expect(cached?.isStale).toBe(true);
      expect(cached?.age).toBeGreaterThan(24 * 60 * 60 * 1000);
    });

    it('should not mark cache as stale before 24 hours', async () => {
      const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60 * 1000; // 23 hours ago
      const cacheData = {
        recommendation: testRecommendation,
        timestamp: twentyThreeHoursAgo,
        outbreakDataTimestamp: testRecommendation.outbreakDataTimestamp.getTime(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

      const cached = await cacheManager.getCachedRecommendation(testChildProfile);

      expect(cached).not.toBeNull();
      expect(cached?.isStale).toBe(false);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache when outbreak data timestamp changes', async () => {
      const oldTimestamp = new Date('2024-01-15T09:00:00Z');
      const newTimestamp = new Date('2024-01-15T10:00:00Z');

      const cacheData = {
        recommendation: testRecommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: oldTimestamp.getTime(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const hasChanged = await cacheManager.checkOutbreakDataChange(
        testChildProfile,
        newTimestamp
      );

      expect(hasChanged).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'rec_2-3_Tokyo'
      );
    });

    it('should not invalidate cache when outbreak data timestamp is unchanged', async () => {
      const timestamp = new Date('2024-01-15T09:00:00Z');

      const cacheData = {
        recommendation: testRecommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: timestamp.getTime(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const hasChanged = await cacheManager.checkOutbreakDataChange(
        testChildProfile,
        timestamp
      );

      expect(hasChanged).toBe(false);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should invalidate cache manually', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await cacheManager.invalidateCache(testChildProfile);

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'rec_2-3_Tokyo'
      );
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate same key for same ageRange and prefecture', async () => {
      const profile1: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Nerima'
        }
      };

      const profile2: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Shibuya' // Different ward
        }
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await cacheManager.getCachedRecommendation(profile1);
      const key1 = (AsyncStorage.getItem as jest.Mock).mock.calls[0][0];

      await cacheManager.getCachedRecommendation(profile2);
      const key2 = (AsyncStorage.getItem as jest.Mock).mock.calls[1][0];

      // Should generate same key (ward is excluded)
      expect(key1).toBe(key2);
      expect(key1).toBe('rec_2-3_Tokyo');
    });

    it('should generate different keys for different age ranges', async () => {
      const profile1: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const profile2: ChildProfile = {
        ageRange: AgeRange.INFANT,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await cacheManager.getCachedRecommendation(profile1);
      const key1 = (AsyncStorage.getItem as jest.Mock).mock.calls[0][0];

      await cacheManager.getCachedRecommendation(profile2);
      const key2 = (AsyncStorage.getItem as jest.Mock).mock.calls[1][0];

      // Should generate different keys
      expect(key1).not.toBe(key2);
      expect(key1).toBe('rec_2-3_Tokyo');
      expect(key2).toBe('rec_0-1_Tokyo');
    });

    it('should generate different keys for different prefectures', async () => {
      const profile1: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const profile2: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Osaka'
        }
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await cacheManager.getCachedRecommendation(profile1);
      const key1 = (AsyncStorage.getItem as jest.Mock).mock.calls[0][0];

      await cacheManager.getCachedRecommendation(profile2);
      const key2 = (AsyncStorage.getItem as jest.Mock).mock.calls[1][0];

      // Should generate different keys
      expect(key1).not.toBe(key2);
      expect(key1).toBe('rec_2-3_Tokyo');
      expect(key2).toBe('rec_2-3_Osaka');
    });
  });

  describe('Age Range Change Detection', () => {
    it('should detect age range change and invalidate cache', async () => {
      const cacheData = {
        recommendation: testRecommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: testRecommendation.outbreakDataTimestamp.getTime(),
        childAgeRange: AgeRange.INFANT // Cached as infant
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      // Check with toddler profile (age range changed)
      const hasChanged = await cacheManager.checkAgeRangeChange(testChildProfile);

      expect(hasChanged).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should not invalidate cache when age range is unchanged', async () => {
      const cacheData = {
        recommendation: testRecommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: testRecommendation.outbreakDataTimestamp.getTime(),
        childAgeRange: AgeRange.TODDLER // Same as profile
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const hasChanged = await cacheManager.checkAgeRangeChange(testChildProfile);

      expect(hasChanged).toBe(false);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('Cache Write', () => {
    it('should write recommendation to cache', async () => {
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const outbreakTimestamp = new Date('2024-01-15T09:00:00Z');

      await cacheManager.setCachedRecommendation(
        testChildProfile,
        testRecommendation,
        outbreakTimestamp
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'rec_2-3_Tokyo',
        expect.any(String)
      );

      // Verify stored data structure
      const storedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      
      // Compare recommendation fields (dates will be serialized as strings)
      expect(storedData.recommendation.id).toBe(testRecommendation.id);
      expect(storedData.recommendation.summary).toBe(testRecommendation.summary);
      expect(storedData.recommendation.riskLevel).toBe(testRecommendation.riskLevel);
      expect(storedData.childAgeRange).toBe(AgeRange.TODDLER);
      expect(storedData.outbreakDataTimestamp).toBe(outbreakTimestamp.getTime());
      expect(storedData.timestamp).toBeDefined();
    });

    it('should not throw on cache write error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      // Should not throw
      await expect(
        cacheManager.setCachedRecommendation(
          testChildProfile,
          testRecommendation,
          new Date()
        )
      ).resolves.not.toThrow();
    });
  });
});
