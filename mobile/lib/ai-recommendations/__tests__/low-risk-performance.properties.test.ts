/**
 * Property-Based Tests for Low Risk Display Performance
 * 
 * **Property 22: Low Risk Display Performance**
 * **Validates: Requirements 9.1**
 * 
 * For any low risk scenario, the system SHALL display the summary within 10 seconds.
 */

import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RiskAnalyzer } from '../risk-analyzer';
import { RecommendationGenerator } from '../recommendation-generator';
import { NovaService } from '../nova-service';
import { CacheManager } from '../cache-manager';
import { Language, RiskLevel } from '../types';
import {
  PBT_CONFIG,
  childProfileArbitrary,
  outbreakDataWithSeverityArbitrary
} from './test-generators';

describe('Low Risk Display Performance Properties - Feature: nova-ai-recommendations', () => {
  let riskAnalyzer: RiskAnalyzer;
  let recommendationGenerator: RecommendationGenerator;
  let cacheManager: CacheManager;
  let novaService: NovaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    
    riskAnalyzer = new RiskAnalyzer();
    novaService = new NovaService();
    recommendationGenerator = new RecommendationGenerator(novaService);
    cacheManager = new CacheManager();
  });

  it('Property 22: Low Risk Display Performance - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        childProfileArbitrary(),
        fc.array(outbreakDataWithSeverityArbitrary(1, 3), { maxLength: 5 }), // Low severity outbreaks
        fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
        async (childProfile, outbreakData, language) => {
          // Calculate risk level
          const riskLevel = await riskAnalyzer.calculateRiskLevel(
            outbreakData,
            childProfile
          );

          // Only test LOW risk scenarios
          if (riskLevel !== RiskLevel.LOW) {
            return true; // Skip non-LOW risk scenarios
          }

          // Measure time to generate recommendation
          const startTime = Date.now();

          const recommendation = await recommendationGenerator.generateRecommendation(
            riskLevel,
            outbreakData,
            childProfile,
            language
          );

          const duration = Date.now() - startTime;

          // Verify recommendation was generated
          expect(recommendation).toBeDefined();
          expect(recommendation.summary).toBeDefined();
          expect(recommendation.summary.length).toBeGreaterThan(0);

          // Property: Display within 10 seconds
          expect(duration).toBeLessThan(10000);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property 22a: Cached Low Risk Display Performance - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        childProfileArbitrary(),
        fc.array(outbreakDataWithSeverityArbitrary(1, 3), { maxLength: 5 }),
        fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
        async (childProfile, outbreakData, language) => {
          const riskLevel = await riskAnalyzer.calculateRiskLevel(
            outbreakData,
            childProfile
          );

          if (riskLevel !== RiskLevel.LOW) {
            return true;
          }

          // Generate and cache recommendation
          const recommendation = await recommendationGenerator.generateRecommendation(
            riskLevel,
            outbreakData,
            childProfile,
            language
          );

          const outbreakDataTimestamp =
            outbreakData.length > 0
              ? new Date(Math.max(...outbreakData.map(o => o.timestamp.getTime())))
              : new Date();

          await cacheManager.setCachedRecommendation(
            childProfile,
            recommendation,
            outbreakDataTimestamp
          );

          // Mock the cached data for retrieval
          const cacheData = {
            recommendation,
            timestamp: Date.now(),
            outbreakDataTimestamp: outbreakDataTimestamp.getTime(),
            childAgeRange: childProfile.ageRange
          };
          (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cacheData));

          // Measure time to retrieve cached recommendation
          const startTime = Date.now();
          const cached = await cacheManager.getCachedRecommendation(childProfile);
          const duration = Date.now() - startTime;

          // Verify cached recommendation exists
          expect(cached).toBeDefined();
          expect(cached?.recommendation).toBeDefined();

          // Property: Cached display should be much faster (< 3 seconds as per Requirement 4.5)
          expect(duration).toBeLessThan(3000);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property 22b: Low Risk Recommendation Quality - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        childProfileArbitrary(),
        fc.array(outbreakDataWithSeverityArbitrary(1, 3), { maxLength: 5 }),
        fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
        async (childProfile, outbreakData, language) => {
          const riskLevel = await riskAnalyzer.calculateRiskLevel(
            outbreakData,
            childProfile
          );

          if (riskLevel !== RiskLevel.LOW) {
            return true;
          }

          const recommendation = await recommendationGenerator.generateRecommendation(
            riskLevel,
            outbreakData,
            childProfile,
            language
          );

          // Verify recommendation structure
          expect(recommendation.summary).toBeDefined();
          expect(recommendation.actionItems).toBeDefined();
          expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
          expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);

          // Verify risk level matches
          expect(recommendation.riskLevel).toBe(RiskLevel.LOW);

          // Verify language matches
          expect(recommendation.language).toBe(language);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });
});
