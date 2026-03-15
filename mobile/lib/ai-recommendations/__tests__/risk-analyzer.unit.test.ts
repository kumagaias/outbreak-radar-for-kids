/**
 * Unit tests for Risk_Analyzer edge cases
 */

import { RiskAnalyzer } from '../risk-analyzer';
import { RiskLevel, AgeRange, OutbreakData, ChildProfile } from '../types';

describe('Risk_Analyzer Unit Tests', () => {
  let riskAnalyzer: RiskAnalyzer;

  beforeEach(() => {
    riskAnalyzer = new RiskAnalyzer();
  });

  describe('Edge Cases', () => {
    it('should return LOW risk for empty outbreak data', async () => {
      const childProfile: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Nerima'
        }
      };

      const riskLevel = await riskAnalyzer.calculateRiskLevel([], childProfile);
      expect(riskLevel).toBe(RiskLevel.LOW);
    });

    it('should return HIGH risk for high-severity outbreak in user area', async () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo',
            countyOrWard: 'Nerima'
          },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 150,
          timestamp: new Date()
        }
      ];

      const childProfile: ChildProfile = {
        ageRange: AgeRange.INFANT,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Nerima'
        }
      };

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      expect(riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should use prefecture fallback when ward data unavailable', async () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 7,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo'
            // No countyOrWard specified
          },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 200,
          timestamp: new Date()
        }
      ];

      const childProfile: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Nerima'
        }
      };

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      
      // Should still detect risk using prefecture-level match
      expect(riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should apply national fallback with 0.5x risk reduction', async () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-002',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Osaka'
          },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 300,
          timestamp: new Date()
        }
      ];

      const childProfile: ChildProfile = {
        ageRange: AgeRange.INFANT,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      
      // With 0.5x national fallback factor, severity 8 * 0.5 * 1.5 (infant) = 6
      // Should be MEDIUM risk (4-6 range)
      expect(riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should ignore outbreaks from different countries', async () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'flu-002',
          diseaseName: 'Influenza',
          severity: 9,
          geographicUnit: {
            country: 'US',
            stateOrPrefecture: 'California'
          },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 500,
          timestamp: new Date()
        }
      ];

      const childProfile: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      
      // Should return LOW risk as outbreak is in different country
      expect(riskLevel).toBe(RiskLevel.LOW);
    });

    it('should handle multiple outbreaks with different severities', async () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'cold-001',
          diseaseName: 'Common Cold',
          severity: 2,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo'
          },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 50,
          timestamp: new Date()
        },
        {
          diseaseId: 'rsv-003',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo'
          },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 100,
          timestamp: new Date()
        }
      ];

      const childProfile: ChildProfile = {
        ageRange: AgeRange.INFANT,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const riskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      
      // Should return HIGH risk due to high-severity RSV outbreak
      expect(riskLevel).toBe(RiskLevel.HIGH);
    });
  });

  describe('Age-Based Susceptibility', () => {
    it('should apply higher weight for infants with respiratory diseases', async () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-004',
          diseaseName: 'RSV',
          severity: 5,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo'
          },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 100,
          timestamp: new Date()
        }
      ];

      const infantProfile: ChildProfile = {
        ageRange: AgeRange.INFANT,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const schoolAgeProfile: ChildProfile = {
        ageRange: AgeRange.SCHOOL_AGE,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const infantRisk = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        infantProfile
      );
      const schoolAgeRisk = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        schoolAgeProfile
      );

      // Infant: 5 * 1.5 (respiratory) = 7.5 → HIGH
      // School age: 5 * 0.9 = 4.5 → MEDIUM
      expect(infantRisk).toBe(RiskLevel.HIGH);
      expect(schoolAgeRisk).toBe(RiskLevel.MEDIUM);
    });
  });
});
