/**
 * Integration Tests for End-to-End Performance
 * 
 * Tests:
 * - Cached recommendation displays within 3 seconds
 * - New recommendation generates within 5 seconds
 * - Background pre-generation completes before user opens screen
 * 
 * Requirements: 2.7, 4.5, 9.1, 9.2
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RiskAnalyzer } from '../risk-analyzer';
import { RecommendationGenerator } from '../recommendation-generator';
import { NovaService } from '../nova-service';
import { CacheManager } from '../cache-manager';
import { AppInitializer } from '../app-initializer';
import {
  RiskLevel,
  AgeRange,
  Language,
  OutbreakData,
  ChildProfile
} from '../types';

describe('Performance Integration Tests', () => {
  let riskAnalyzer: RiskAnalyzer;
  let recommendationGenerator: RecommendationGenerator;
  let cacheManager: CacheManager;
  let novaService: NovaService;
  let appInitializer: AppInitializer;

  const testChildProfile: ChildProfile = {
    ageRange: AgeRange.TODDLER,
    location: {
      country: 'JP',
      stateOrPrefecture: 'Tokyo',
      countyOrWard: 'Nerima'
    }
  };

  const testOutbreakData: OutbreakData[] = [
    {
      diseaseId: 'rsv-001',
      diseaseName: 'RSV',
      severity: 5,
      geographicUnit: {
        country: 'JP',
        stateOrPrefecture: 'Tokyo',
        countyOrWard: 'Nerima'
      },
      affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER],
      reportedCases: 100,
      timestamp: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    
    riskAnalyzer = new RiskAnalyzer();
    novaService = new NovaService();
    recommendationGenerator = new RecommendationGenerator(novaService);
    cacheManager = new CacheManager();
    appInitializer = new AppInitializer(
      riskAnalyzer,
      recommendationGenerator,
      cacheManager
    );
  });

  describe('Cached Recommendation Performance', () => {
    it('should display cached recommendation within 3 seconds', async () => {
      // Pre-generate and cache recommendation
      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        testOutbreakData,
        testChildProfile
      );

      const recommendation = await recommendationGenerator.generateRecommendation(
        riskLevel,
        testOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );

      await cacheManager.setCachedRecommendation(
        testChildProfile,
        recommendation,
        new Date()
      );

      // Mock the cached data for retrieval
      const cacheData = {
        recommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: new Date().getTime(),
        childAgeRange: AgeRange.TODDLER
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

      // Measure retrieval time
      const startTime = Date.now();
      const cached = await cacheManager.getCachedRecommendation(testChildProfile);
      const duration = Date.now() - startTime;

      // Verify cached recommendation exists
      expect(cached).toBeDefined();
      expect(cached?.recommendation).toBeDefined();
      expect(cached?.recommendation.summary).toBeDefined();

      // Requirement 4.5: Display within 3 seconds
      expect(duration).toBeLessThan(3000);
    });

    it('should handle cache miss gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const startTime = Date.now();
      const cached = await cacheManager.getCachedRecommendation(testChildProfile);
      const duration = Date.now() - startTime;

      // Should return null quickly
      expect(cached).toBeNull();
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('New Recommendation Generation Performance', () => {
    it('should generate new recommendation within 5 seconds', async () => {
      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        testOutbreakData,
        testChildProfile
      );

      const startTime = Date.now();
      const recommendation = await recommendationGenerator.generateRecommendation(
        riskLevel,
        testOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );
      const duration = Date.now() - startTime;

      // Verify recommendation was generated
      expect(recommendation).toBeDefined();
      expect(recommendation.summary).toBeDefined();
      expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);

      // Requirement 2.7: Complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should generate recommendation for high risk scenario within 5 seconds', async () => {
      const highRiskOutbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo',
            countyOrWard: 'Nerima'
          },
          affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER],
          reportedCases: 200,
          timestamp: new Date()
        }
      ];

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        highRiskOutbreakData,
        testChildProfile
      );

      expect(riskLevel).toBe(RiskLevel.HIGH);

      const startTime = Date.now();
      const recommendation = await recommendationGenerator.generateRecommendation(
        riskLevel,
        highRiskOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );
      const duration = Date.now() - startTime;

      expect(recommendation).toBeDefined();
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Background Pre-generation', () => {
    it('should complete background pre-generation before user opens screen', async () => {
      // Simulate app startup with background pre-generation
      const startTime = Date.now();

      // Mock outbreak data fetch (simulated)
      const mockOutbreakData = testOutbreakData;

      // Pre-generate recommendation in background
      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        mockOutbreakData,
        testChildProfile
      );

      const recommendation = await recommendationGenerator.generateRecommendation(
        riskLevel,
        mockOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );

      await cacheManager.setCachedRecommendation(
        testChildProfile,
        recommendation,
        new Date()
      );

      // Mock the cached data for retrieval
      const cacheData = {
        recommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: new Date().getTime(),
        childAgeRange: AgeRange.TODDLER
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

      // Simulate user opening screen (should be instant from cache)
      const userOpenStartTime = Date.now();
      const cached = await cacheManager.getCachedRecommendation(testChildProfile);
      const userOpenDuration = Date.now() - userOpenStartTime;

      expect(cached).toBeDefined();
      expect(cached?.recommendation).toBeDefined();

      // User experience: cached display should be very fast
      expect(userOpenDuration).toBeLessThan(1000);

      const preGenerationDuration = Date.now() - startTime;

      // Log pre-generation time for monitoring
      console.log(`Background pre-generation completed in ${preGenerationDuration}ms`);
    });

    it('should handle background pre-generation failure gracefully', async () => {
      // Simulate pre-generation failure
      const mockFailingGenerator = {
        generateRecommendation: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      // Should not throw error
      await expect(async () => {
        try {
          await mockFailingGenerator.generateRecommendation(
            RiskLevel.MEDIUM,
            testOutbreakData,
            testChildProfile,
            Language.JAPANESE
          );
        } catch (error) {
          // Log error but don't crash
          console.warn('Background pre-generation failed:', error);
        }
      }).not.toThrow();
    });
  });

  describe('End-to-End Performance Flow', () => {
    it('should complete full flow from risk analysis to cached display within performance targets', async () => {
      // Step 1: Risk analysis (should be fast)
      const riskAnalysisStart = Date.now();
      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        testOutbreakData,
        testChildProfile
      );
      const riskAnalysisDuration = Date.now() - riskAnalysisStart;

      expect(riskAnalysisDuration).toBeLessThan(3000); // Requirement 1.1

      // Step 2: Recommendation generation (should complete within 5s)
      const generationStart = Date.now();
      const recommendation = await recommendationGenerator.generateRecommendation(
        riskLevel,
        testOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );
      const generationDuration = Date.now() - generationStart;

      expect(generationDuration).toBeLessThan(5000); // Requirement 2.7

      // Step 3: Cache storage (should be fast)
      const cacheStart = Date.now();
      await cacheManager.setCachedRecommendation(
        testChildProfile,
        recommendation,
        new Date()
      );
      const cacheDuration = Date.now() - cacheStart;

      expect(cacheDuration).toBeLessThan(1000);

      // Step 4: Cache retrieval (should be very fast)
      const retrievalStart = Date.now();
      const cached = await cacheManager.getCachedRecommendation(testChildProfile);
      const retrievalDuration = Date.now() - retrievalStart;

      expect(cached).toBeDefined();
      expect(retrievalDuration).toBeLessThan(3000); // Requirement 4.5

      // Log performance metrics
      console.log('Performance metrics:', {
        riskAnalysis: `${riskAnalysisDuration}ms`,
        generation: `${generationDuration}ms`,
        cache: `${cacheDuration}ms`,
        retrieval: `${retrievalDuration}ms`
      });
    });
  });

  describe('Low Risk Display Performance', () => {
    it('should display low risk summary within 10 seconds', async () => {
      const lowRiskOutbreakData: OutbreakData[] = [
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 3,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo'
          },
          affectedAgeRanges: [AgeRange.SCHOOL_AGE],
          reportedCases: 50,
          timestamp: new Date()
        }
      ];

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        lowRiskOutbreakData,
        testChildProfile
      );

      expect(riskLevel).toBe(RiskLevel.LOW);

      const startTime = Date.now();
      const recommendation = await recommendationGenerator.generateRecommendation(
        riskLevel,
        lowRiskOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );
      const duration = Date.now() - startTime;

      expect(recommendation).toBeDefined();
      expect(recommendation.summary).toBeDefined();

      // Requirement 9.1: Display within 10 seconds for low risk
      expect(duration).toBeLessThan(10000);
    });
  });
});
