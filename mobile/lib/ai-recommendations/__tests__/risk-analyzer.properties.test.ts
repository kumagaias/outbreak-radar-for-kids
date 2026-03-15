/**
 * Property-based tests for Risk_Analyzer
 * Feature: nova-ai-recommendations
 */

import * as fc from 'fast-check';
import { RiskAnalyzer } from '../risk-analyzer';
import { RiskLevel } from '../types';
import {
  PBT_CONFIG,
  outbreakDataArrayArbitrary,
  childProfileArbitrary,
  outbreakDataWithSeverityArbitrary,
  outbreakDataInLocationArbitrary,
  childProfileWithLocationArbitrary,
  ageRangeArbitrary,
  geographicUnitArbitrary
} from './test-generators';

describe('Risk_Analyzer Properties', () => {
  let riskAnalyzer: RiskAnalyzer;

  beforeEach(() => {
    riskAnalyzer = new RiskAnalyzer();
  });

  /**
   * Property 1: Risk Level Calculation Performance
   * Validates: Requirements 1.1
   */
  it('Property 1: Risk Level Calculation Performance - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        outbreakDataArrayArbitrary(),
        childProfileArbitrary(),
        async (outbreakData, childProfile) => {
          const startTime = Date.now();
          const riskLevel = await riskAnalyzer.calculateRiskLevel(
            outbreakData,
            childProfile
          );
          const duration = Date.now() - startTime;

          expect(duration).toBeLessThan(3000);
          expect(riskLevel).toBeDefined();
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property 2: Risk Level Output Constraint
   * Validates: Requirements 1.5
   */
  it('Property 2: Risk Level Output Constraint - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        outbreakDataArrayArbitrary(),
        childProfileArbitrary(),
        async (outbreakData, childProfile) => {
          const riskLevel = await riskAnalyzer.calculateRiskLevel(
            outbreakData,
            childProfile
          );

          const validRiskLevels = [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW];
          expect(validRiskLevels).toContain(riskLevel);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property 3: Severity-Based Risk Classification
   * Validates: Requirements 1.6, 1.7, 1.8, 1.9
   */
  it('Property 3: Severity-Based Risk Classification - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        childProfileArbitrary(),
        async (childProfile) => {
          // Test high severity (10) with exact location match returns HIGH risk
          // Use severity 10 to ensure weighted severity ≥7 even with age/proximity factors
          const highSeverityOutbreak = fc.sample(outbreakDataWithSeverityArbitrary(10, 10), 1)[0];
          const highOutbreakInLocation = {
            ...highSeverityOutbreak,
            geographicUnit: {
              ...childProfile.location,
              countyOrWard: childProfile.location.countyOrWard || 'TestWard'
            }
          };
          const highRisk = await riskAnalyzer.calculateRiskLevel(
            [highOutbreakInLocation],
            childProfile
          );
          expect(highRisk).toBe(RiskLevel.HIGH);

          // Test low severity (2) returns LOW risk
          // Use severity 2 to ensure weighted severity < 4 even with max age weight (1.5x)
          // 2 * 1.5 = 3.0 < 4 (MEDIUM threshold)
          const lowSeverityOutbreak = fc.sample(outbreakDataWithSeverityArbitrary(2, 2), 1)[0];
          const lowOutbreakInLocation = {
            ...lowSeverityOutbreak,
            geographicUnit: childProfile.location
          };
          const lowRisk = await riskAnalyzer.calculateRiskLevel(
            [lowOutbreakInLocation],
            childProfile
          );
          expect(lowRisk).toBe(RiskLevel.LOW);

          // Test no outbreaks returns LOW risk
          const noOutbreakRisk = await riskAnalyzer.calculateRiskLevel([], childProfile);
          expect(noOutbreakRisk).toBe(RiskLevel.LOW);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property 4: Age Range Influence on Risk
   * Validates: Requirements 1.2
   */
  it('Property 4: Age Range Influence on Risk - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        geographicUnitArbitrary(),
        fc.integer({ min: 7, max: 10 }),
        async (location, severity) => {
          // Create respiratory outbreak (higher weight for infants)
          const respiratoryOutbreak = {
            diseaseId: 'test-rsv',
            diseaseName: 'RSV',
            severity,
            geographicUnit: location,
            affectedAgeRanges: [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW] as any,
            reportedCases: 100,
            timestamp: new Date()
          };

          const infantProfile = { ageRange: 'INFANT' as any, location };
          const schoolAgeProfile = { ageRange: 'SCHOOL_AGE' as any, location };

          const infantRisk = await riskAnalyzer.calculateRiskLevel(
            [respiratoryOutbreak],
            infantProfile
          );
          const schoolAgeRisk = await riskAnalyzer.calculateRiskLevel(
            [respiratoryOutbreak],
            schoolAgeProfile
          );

          // Infant should have same or higher risk due to 1.5x weight vs 0.9x for school age
          const riskOrder = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
          const infantRiskIndex = riskOrder.indexOf(infantRisk);
          const schoolAgeRiskIndex = riskOrder.indexOf(schoolAgeRisk);
          
          expect(infantRiskIndex).toBeGreaterThanOrEqual(schoolAgeRiskIndex);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property 5: Geographic Proximity Influence on Risk
   * Validates: Requirements 1.3
   */
  it('Property 5: Geographic Proximity Influence on Risk - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 7, max: 10 }),
        async (severity) => {
          const tokyo = {
            country: 'JP',
            stateOrPrefecture: 'Tokyo',
            countyOrWard: 'Nerima'
          };
          const osaka = {
            country: 'JP',
            stateOrPrefecture: 'Osaka'
          };

          const outbreakInTokyo = {
            diseaseId: 'test-flu',
            diseaseName: 'Influenza',
            severity,
            geographicUnit: tokyo,
            affectedAgeRanges: ['TODDLER' as any],
            reportedCases: 100,
            timestamp: new Date()
          };

          const childInNerima = {
            ageRange: 'TODDLER' as any,
            location: tokyo
          };
          const childInOsaka = {
            ageRange: 'TODDLER' as any,
            location: osaka
          };

          const nerimaRisk = await riskAnalyzer.calculateRiskLevel(
            [outbreakInTokyo],
            childInNerima
          );
          const osakaRisk = await riskAnalyzer.calculateRiskLevel(
            [outbreakInTokyo],
            childInOsaka
          );

          // Child in Nerima (exact match) should have higher or equal risk than child in Osaka
          const riskOrder = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
          const nerimaRiskIndex = riskOrder.indexOf(nerimaRisk);
          const osakaRiskIndex = riskOrder.indexOf(osakaRisk);
          
          expect(nerimaRiskIndex).toBeGreaterThanOrEqual(osakaRiskIndex);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property 6: Disease Severity Influence on Risk
   * Validates: Requirements 1.4
   */
  it('Property 6: Disease Severity Influence on Risk - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        childProfileArbitrary(),
        async (childProfile) => {
          const lowSeverityOutbreak = {
            diseaseId: 'test-low',
            diseaseName: 'Common Cold',
            severity: 2,
            geographicUnit: childProfile.location,
            affectedAgeRanges: [childProfile.ageRange],
            reportedCases: 100,
            timestamp: new Date()
          };

          const highSeverityOutbreak = {
            ...lowSeverityOutbreak,
            diseaseId: 'test-high',
            severity: 9
          };

          const lowRisk = await riskAnalyzer.calculateRiskLevel(
            [lowSeverityOutbreak],
            childProfile
          );
          const highRisk = await riskAnalyzer.calculateRiskLevel(
            [highSeverityOutbreak],
            childProfile
          );

          // Higher severity should produce higher or equal risk
          const riskOrder = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
          const lowRiskIndex = riskOrder.indexOf(lowRisk);
          const highRiskIndex = riskOrder.indexOf(highRisk);
          
          expect(highRiskIndex).toBeGreaterThanOrEqual(lowRiskIndex);
        }
      ),
      PBT_CONFIG
    );
  });
});
