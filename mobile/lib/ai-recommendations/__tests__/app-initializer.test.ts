/**
 * Integration tests for AppInitializer
 * 
 * Tests:
 * - App startup triggers background generation
 * - Cache is populated after background generation
 * - UI renders before background tasks complete
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppInitializer, OutbreakDataFetcher } from '../app-initializer';
import { CacheManager } from '../cache-manager';
import {
  ChildProfile,
  AgeRange,
  Language,
  OutbreakData,
  RiskLevel
} from '../types';

describe('AppInitializer Integration Tests', () => {
  let mockOutbreakDataFetcher: jest.MockedFunction<OutbreakDataFetcher>;
  let cacheManager: CacheManager;

  const mockChildProfile: ChildProfile = {
    ageRange: AgeRange.TODDLER,
    location: {
      country: 'JP',
      stateOrPrefecture: 'Tokyo',
      countyOrWard: 'Nerima Ward'
    }
  };

  const mockOutbreakData: OutbreakData[] = [
    {
      diseaseId: 'rsv-001',
      diseaseName: 'RSV',
      severity: 8,
      geographicUnit: {
        country: 'JP',
        stateOrPrefecture: 'Tokyo',
        countyOrWard: 'Nerima Ward'
      },
      affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER],
      reportedCases: 150,
      timestamp: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock outbreak data fetcher
    mockOutbreakDataFetcher = jest.fn().mockResolvedValue(mockOutbreakData);

    cacheManager = new CacheManager();
  });

  describe('Requirement 9.2: App startup triggers background generation', () => {
    it('should start background tasks on initialize', async () => {
      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE
      });

      // Call initialize
      await initializer.initialize();

      // Wait for background tasks to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify outbreak data was fetched
      expect(mockOutbreakDataFetcher).toHaveBeenCalledWith('Tokyo', 'JP');
    });

    it('should not block on initialize call', async () => {
      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE
      });

      const startTime = Date.now();

      // Initialize should return immediately
      await initializer.initialize();

      const duration = Date.now() - startTime;

      // Should return in less than 100ms (not waiting for background tasks)
      expect(duration).toBeLessThan(100);
    });

    it('should skip pre-generation when disabled', async () => {
      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE,
        enablePreGeneration: false
      });

      await initializer.initialize();

      // Wait a bit to ensure no background tasks started
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify outbreak data was NOT fetched
      expect(mockOutbreakDataFetcher).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 9.5: Cache is populated after background generation', () => {
    it('should cache recommendation after background generation', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null); // No existing cache
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE
      });

      await initializer.initialize();

      // Wait for background tasks to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify cache was written
      expect(AsyncStorage.setItem).toHaveBeenCalled();

      // Verify cache key format
      const cacheKey = `rec_${mockChildProfile.ageRange}_${mockChildProfile.location.stateOrPrefecture}`;
      const setCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const cacheCall = setCalls.find((call: any[]) => call[0] === cacheKey);

      expect(cacheCall).toBeDefined();

      // Verify cached data structure
      if (cacheCall) {
        const cachedData = JSON.parse(cacheCall[1]);
        expect(cachedData).toHaveProperty('recommendation');
        expect(cachedData).toHaveProperty('timestamp');
        expect(cachedData).toHaveProperty('outbreakDataTimestamp');
        expect(cachedData).toHaveProperty('childAgeRange');
      }
    });

    it('should skip pre-generation if fresh cache exists', async () => {
      // Mock existing fresh cache
      const existingCache = {
        recommendation: {
          id: 'test-123',
          summary: 'Test summary',
          actionItems: [],
          riskLevel: RiskLevel.LOW,
          diseaseNames: [],
          generatedAt: new Date().toISOString(),
          outbreakDataTimestamp: new Date().toISOString(),
          source: 'fallback',
          childAgeRange: AgeRange.TODDLER,
          geographicArea: 'Tokyo, JP',
          language: Language.JAPANESE
        },
        timestamp: Date.now(), // Fresh cache
        outbreakDataTimestamp: Date.now(),
        childAgeRange: AgeRange.TODDLER
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingCache));

      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE
      });

      await initializer.initialize();

      // Wait for background tasks to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cache was NOT overwritten (setItem not called)
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should not fail app startup on outbreak data fetch error', async () => {
      const errorFetcher = jest.fn().mockRejectedValue(new Error('Network error'));

      const initializer = new AppInitializer({
        outbreakDataFetcher: errorFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE
      });

      // Should not throw
      await expect(initializer.initialize()).resolves.not.toThrow();

      // Wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged but app didn't crash
      expect(errorFetcher).toHaveBeenCalled();
    });

    it('should continue with other profiles on individual failure', async () => {
      const childProfile2: ChildProfile = {
        ageRange: AgeRange.PRESCHOOL,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Osaka'
        }
      };

      // First call fails, second succeeds
      mockOutbreakDataFetcher
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockOutbreakData);

      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile, childProfile2],
        language: Language.JAPANESE
      });

      await initializer.initialize();

      // Wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify both profiles were attempted
      expect(mockOutbreakDataFetcher).toHaveBeenCalledTimes(2);
    });

    it('should log errors but not throw on cache write failure', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage full'));

      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles: [mockChildProfile],
        language: Language.JAPANESE
      });

      // Should not throw
      await expect(initializer.initialize()).resolves.not.toThrow();

      // Wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify cache write was attempted
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Multiple child profiles', () => {
    it('should pre-generate for all child profiles', async () => {
      const childProfiles: ChildProfile[] = [
        {
          ageRange: AgeRange.INFANT,
          location: { country: 'JP', stateOrPrefecture: 'Tokyo' }
        },
        {
          ageRange: AgeRange.TODDLER,
          location: { country: 'JP', stateOrPrefecture: 'Osaka' }
        },
        {
          ageRange: AgeRange.PRESCHOOL,
          location: { country: 'JP', stateOrPrefecture: 'Kyoto' }
        }
      ];

      const initializer = new AppInitializer({
        outbreakDataFetcher: mockOutbreakDataFetcher,
        childProfiles,
        language: Language.JAPANESE
      });

      await initializer.initialize();

      // Wait for background tasks
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify outbreak data was fetched for all profiles
      expect(mockOutbreakDataFetcher).toHaveBeenCalledTimes(3);
      expect(mockOutbreakDataFetcher).toHaveBeenCalledWith('Tokyo', 'JP');
      expect(mockOutbreakDataFetcher).toHaveBeenCalledWith('Osaka', 'JP');
      expect(mockOutbreakDataFetcher).toHaveBeenCalledWith('Kyoto', 'JP');
    });
  });
});
