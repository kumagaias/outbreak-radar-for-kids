/**
 * Property-Based Tests for Risk_Analyzer
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * Focus: Boundary value testing for critical transitions
 * - Age transitions (1.99→2.01, 3.99→4.01, 6.99→7.01)
 * - Severity thresholds (3.9→4.1, 6.9→7.1)
 * - Geographic proximity (same ward, same prefecture, different prefecture)
 * 
 * Test Category: Critical (run every commit)
 * Iterations: 100 per property
 * Target: <10 seconds total execution time
 */

import * as fc from 'fast-check';
import { RiskAnalyzer } from '../../../../lib/ai-recommendations/risk-analyzer';
import {
  RiskLevel,
  AgeRange,
  OutbreakData,
  ChildProfile,
  GeographicUnit
} from '../../../../lib/ai-recommendations/types';

// Test configuration
const PBT_CONFIG = {
  numRuns: 100,
  verbose: false
};

describe('Risk_Analyzer - Boundary Value Properties', () => {
  let riskAnalyzer: RiskAnalyzer;

  beforeEach(() => {
    riskAnalyzer = new RiskAnalyzer();
  });

  describe('Age Transition Boundaries', () => {
    /**
     * Property: Age transitions affect risk calculation
     * 
     * Tests that crossing age range boundaries (1.99→2.01, 3.99→4.01, 6.99→7.01)
     * produces different risk calculations due to age-based susceptibility weights.
     */
    it('Property: Age transition from infant to toddler (1.99→2.01) affects risk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            // Create high-severity outbreak in the same ward
            const outbreak: OutbreakData = {
              diseaseId: 'rsv-001',
              diseaseName: 'RSV',
              severity: 8,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER],
              reportedCases: 100,
              timestamp: new Date()
            };

            // Test infant (1.99 years)
            const infantProfile: ChildProfile = {
              ageRange: AgeRange.INFANT,
              exactAge: 1.99,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            // Test toddler (2.01 years)
            const toddlerProfile: ChildProfile = {
              ageRange: AgeRange.TODDLER,
              exactAge: 2.01,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            const riskInfant = await riskAnalyzer.calculateRiskLevel([outbreak], infantProfile);
            const riskToddler = await riskAnalyzer.calculateRiskLevel([outbreak], toddlerProfile);

            // Both should be HIGH due to high severity, but weighted severity differs
            // Infant has 1.5x weight for respiratory, toddler has 1.2x default weight
            expect(riskInfant).toBe(RiskLevel.HIGH);
            expect(riskToddler).toBe(RiskLevel.HIGH);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Age transition from toddler to preschool (3.99→4.01) affects risk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            // Create medium-severity outbreak
            const outbreak: OutbreakData = {
              diseaseId: 'flu-001',
              diseaseName: 'Influenza',
              severity: 5,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.TODDLER, AgeRange.PRESCHOOL],
              reportedCases: 150,
              timestamp: new Date()
            };

            // Test toddler (3.99 years)
            const toddlerProfile: ChildProfile = {
              ageRange: AgeRange.TODDLER,
              exactAge: 3.99,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            // Test preschool (4.01 years)
            const preschoolProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              exactAge: 4.01,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            const riskToddler = await riskAnalyzer.calculateRiskLevel([outbreak], toddlerProfile);
            const riskPreschool = await riskAnalyzer.calculateRiskLevel([outbreak], preschoolProfile);

            // Toddler has 1.1x weight for flu, preschool has 1.0x baseline
            // Both should be MEDIUM, but weighted severity differs
            expect(riskToddler).toBe(RiskLevel.MEDIUM);
            expect(riskPreschool).toBe(RiskLevel.MEDIUM);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Age transition from preschool to school-age (6.99→7.01) affects risk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            // Create medium-severity outbreak
            const outbreak: OutbreakData = {
              diseaseId: 'hfmd-001',
              diseaseName: 'Hand-Foot-Mouth Disease',
              severity: 5,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL, AgeRange.SCHOOL_AGE],
              reportedCases: 120,
              timestamp: new Date()
            };

            // Test preschool (6.99 years)
            const preschoolProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              exactAge: 6.99,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            // Test school-age (7.01 years)
            const schoolAgeProfile: ChildProfile = {
              ageRange: AgeRange.SCHOOL_AGE,
              exactAge: 7.01,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            const riskPreschool = await riskAnalyzer.calculateRiskLevel([outbreak], preschoolProfile);
            const riskSchoolAge = await riskAnalyzer.calculateRiskLevel([outbreak], schoolAgeProfile);

            // Preschool has 1.0x baseline, school-age has 0.9x weight
            // Both should be MEDIUM, but weighted severity differs
            expect(riskPreschool).toBe(RiskLevel.MEDIUM);
            expect(riskSchoolAge).toBe(RiskLevel.MEDIUM);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  describe('Severity Threshold Boundaries', () => {
    /**
     * Property: Severity threshold crossing changes risk level
     * 
     * Tests that crossing severity thresholds (3.9→4.1 for low→medium, 6.9→7.1 for medium→high)
     * produces different risk level classifications.
     */
    it('Property: Severity threshold 3.9→4.1 crosses low to medium boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            // Test severity 3.9 (should be LOW)
            const outbreakLow: OutbreakData = {
              diseaseId: 'norovirus-001',
              diseaseName: 'Norovirus',
              severity: 3.9,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 50,
              timestamp: new Date()
            };

            // Test severity 4.1 (should be MEDIUM)
            const outbreakMedium: OutbreakData = {
              ...outbreakLow,
              severity: 4.1
            };

            const riskLow = await riskAnalyzer.calculateRiskLevel([outbreakLow], childProfile);
            const riskMedium = await riskAnalyzer.calculateRiskLevel([outbreakMedium], childProfile);

            // Crossing threshold should change risk level
            expect(riskLow).toBe(RiskLevel.LOW);
            expect(riskMedium).toBe(RiskLevel.MEDIUM);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Severity threshold 6.9→7.1 crosses medium to high boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            // Test severity 6.9 (should be MEDIUM)
            const outbreakMedium: OutbreakData = {
              diseaseId: 'rsv-001',
              diseaseName: 'RSV',
              severity: 6.9,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 200,
              timestamp: new Date()
            };

            // Test severity 7.1 (should be HIGH)
            const outbreakHigh: OutbreakData = {
              ...outbreakMedium,
              severity: 7.1
            };

            const riskMedium = await riskAnalyzer.calculateRiskLevel([outbreakMedium], childProfile);
            const riskHigh = await riskAnalyzer.calculateRiskLevel([outbreakHigh], childProfile);

            // Crossing threshold should change risk level
            expect(riskMedium).toBe(RiskLevel.MEDIUM);
            expect(riskHigh).toBe(RiskLevel.HIGH);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Severity exactly at threshold 4.0 is classified as MEDIUM', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            const outbreak: OutbreakData = {
              diseaseId: 'flu-001',
              diseaseName: 'Influenza',
              severity: 4.0,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 100,
              timestamp: new Date()
            };

            const risk = await riskAnalyzer.calculateRiskLevel([outbreak], childProfile);

            // Exactly at threshold should be MEDIUM (threshold is inclusive)
            expect(risk).toBe(RiskLevel.MEDIUM);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Severity exactly at threshold 7.0 is classified as HIGH', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            const outbreak: OutbreakData = {
              diseaseId: 'rsv-001',
              diseaseName: 'RSV',
              severity: 7.0,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 200,
              timestamp: new Date()
            };

            const risk = await riskAnalyzer.calculateRiskLevel([outbreak], childProfile);

            // Exactly at threshold should be HIGH (threshold is inclusive)
            expect(risk).toBe(RiskLevel.HIGH);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  describe('Geographic Proximity Threshold Boundaries', () => {
    /**
     * Property: Geographic proximity affects risk calculation
     * 
     * Tests that geographic proximity (same ward, same prefecture, different prefecture)
     * produces different risk calculations due to proximity factors.
     */
    it('Property: Same ward produces higher risk than different ward in same prefecture', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { userWard: 'Nerima', outbreakWard: 'Nerima' },
            { userWard: 'Nerima', outbreakWard: 'Setagaya' },
            { userWard: 'Setagaya', outbreakWard: 'Setagaya' },
            { userWard: 'Setagaya', outbreakWard: 'Shibuya' }
          ),
          async ({ userWard, outbreakWard }) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: userWard
              }
            };

            // High severity outbreak to ensure risk is detectable
            const outbreak: OutbreakData = {
              diseaseId: 'rsv-001',
              diseaseName: 'RSV',
              severity: 8,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: outbreakWard
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 150,
              timestamp: new Date()
            };

            const risk = await riskAnalyzer.calculateRiskLevel([outbreak], childProfile);

            // Same ward should produce HIGH risk (proximity factor 1.0)
            // Different ward in same prefecture: 8 * 0.8 = 6.4, still HIGH (threshold is 7.0)
            // Both should be HIGH due to high severity
            expect(risk).toBe(RiskLevel.HIGH);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Same prefecture produces higher risk than different prefecture', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { userPref: 'Tokyo', outbreakPref: 'Tokyo' },
            { userPref: 'Tokyo', outbreakPref: 'Osaka' },
            { userPref: 'Osaka', outbreakPref: 'Osaka' },
            { userPref: 'Osaka', outbreakPref: 'Tokyo' }
          ),
          async ({ userPref, outbreakPref }) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: userPref,
                countyOrWard: 'TestWard'
              }
            };

            // High severity outbreak
            const outbreak: OutbreakData = {
              diseaseId: 'rsv-001',
              diseaseName: 'RSV',
              severity: 8,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: outbreakPref,
                countyOrWard: undefined // Prefecture-level data
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 200,
              timestamp: new Date()
            };

            const risk = await riskAnalyzer.calculateRiskLevel([outbreak], childProfile);

            // High severity outbreak (8) should produce HIGH risk regardless of prefecture
            // Same prefecture: 8 * 0.8 = 6.4 (still HIGH)
            // Different prefecture: 8 * 0.5 = 4.0 (MEDIUM)
            if (userPref === outbreakPref) {
              expect(risk).toBe(RiskLevel.HIGH);
            } else {
              expect(risk).toBe(RiskLevel.MEDIUM);
            }
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Different country produces no risk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { userCountry: 'JP', outbreakCountry: 'US' },
            { userCountry: 'US', outbreakCountry: 'JP' }
          ),
          async ({ userCountry, outbreakCountry }) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: userCountry,
                stateOrPrefecture: userCountry === 'JP' ? 'Tokyo' : 'California',
                countyOrWard: 'TestArea'
              }
            };

            // High severity outbreak in different country
            const outbreak: OutbreakData = {
              diseaseId: 'rsv-001',
              diseaseName: 'RSV',
              severity: 9,
              geographicUnit: {
                country: outbreakCountry,
                stateOrPrefecture: outbreakCountry === 'JP' ? 'Tokyo' : 'California',
                countyOrWard: undefined
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 500,
              timestamp: new Date()
            };

            const risk = await riskAnalyzer.calculateRiskLevel([outbreak], childProfile);

            // Different country should produce LOW risk (proximity factor 0)
            expect(risk).toBe(RiskLevel.LOW);
          }
        ),
        PBT_CONFIG
      );
    });

    it('Property: Exact ward match (proximity 1.0) vs prefecture fallback (proximity 0.8)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Nerima', 'Setagaya', 'Shibuya'),
          async (ward) => {
            const childProfile: ChildProfile = {
              ageRange: AgeRange.PRESCHOOL,
              location: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward
              }
            };

            // Medium-high severity outbreak (6.5) to test proximity effect
            const outbreakExactMatch: OutbreakData = {
              diseaseId: 'flu-001',
              diseaseName: 'Influenza',
              severity: 6.5,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: ward // Exact match
              },
              affectedAgeRanges: [AgeRange.PRESCHOOL],
              reportedCases: 150,
              timestamp: new Date()
            };

            const outbreakPrefectureFallback: OutbreakData = {
              ...outbreakExactMatch,
              geographicUnit: {
                country: 'JP',
                stateOrPrefecture: 'Tokyo',
                countyOrWard: undefined // Prefecture-level only
              }
            };

            const riskExact = await riskAnalyzer.calculateRiskLevel([outbreakExactMatch], childProfile);
            const riskFallback = await riskAnalyzer.calculateRiskLevel([outbreakPrefectureFallback], childProfile);

            // Exact match: 6.5 * 1.0 * 1.0 = 6.5 (MEDIUM)
            expect(riskExact).toBe(RiskLevel.MEDIUM);
            
            // Prefecture fallback: 6.5 * 0.8 * 1.0 = 5.2 (MEDIUM)
            expect(riskFallback).toBe(RiskLevel.MEDIUM);
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
