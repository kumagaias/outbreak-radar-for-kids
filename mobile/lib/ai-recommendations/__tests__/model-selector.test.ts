/**
 * Unit tests for ModelSelector
 */

import { ModelSelector } from '../model-selector';
import { RiskLevel, OutbreakData, AgeRange } from '../types';
import { NovaModel } from '../nova-service';

describe('ModelSelector', () => {
  let modelSelector: ModelSelector;

  beforeEach(() => {
    modelSelector = new ModelSelector();
  });

  describe('selectModel', () => {
    it('should select MICRO for LOW risk with simple outbreak (single disease)', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 3,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 50,
          timestamp: new Date()
        }
      ];

      const model = modelSelector.selectModel(RiskLevel.LOW, outbreakData);
      expect(model).toBe(NovaModel.MICRO);
    });

    it('should select LITE for LOW risk with complex outbreak (multiple diseases)', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 3,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 50,
          timestamp: new Date()
        },
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 4,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 100,
          timestamp: new Date()
        },
        {
          diseaseId: 'noro-001',
          diseaseName: 'Norovirus',
          severity: 5,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.PRESCHOOL],
          reportedCases: 75,
          timestamp: new Date()
        }
      ];

      const model = modelSelector.selectModel(RiskLevel.LOW, outbreakData);
      expect(model).toBe(NovaModel.LITE);
    });

    it('should select LITE for MEDIUM risk', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 5,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 100,
          timestamp: new Date()
        }
      ];

      const model = modelSelector.selectModel(RiskLevel.MEDIUM, outbreakData);
      expect(model).toBe(NovaModel.LITE);
    });

    it('should select LITE for HIGH risk', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 200,
          timestamp: new Date()
        }
      ];

      const model = modelSelector.selectModel(RiskLevel.HIGH, outbreakData);
      expect(model).toBe(NovaModel.LITE);
    });

    it('should select MICRO for empty outbreak data', () => {
      const model = modelSelector.selectModel(RiskLevel.LOW, []);
      expect(model).toBe(NovaModel.MICRO);
    });
  });

  describe('calculateOutbreakComplexity', () => {
    it('should return 0 for empty outbreak data', () => {
      const complexity = modelSelector.calculateOutbreakComplexity([]);
      expect(complexity).toBe(0);
    });

    it('should return 1 for single disease with low variance', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 5,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 50,
          timestamp: new Date()
        }
      ];

      const complexity = modelSelector.calculateOutbreakComplexity(outbreakData);
      expect(complexity).toBe(1);
    });

    it('should count unique diseases correctly', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 5,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 50,
          timestamp: new Date()
        },
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 6,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 100,
          timestamp: new Date()
        }
      ];

      const complexity = modelSelector.calculateOutbreakComplexity(outbreakData);
      expect(complexity).toBeGreaterThanOrEqual(2);
    });

    it('should add variance bonus for high severity variance', () => {
      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 2,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 50,
          timestamp: new Date()
        },
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 9,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 100,
          timestamp: new Date()
        }
      ];

      const complexity = modelSelector.calculateOutbreakComplexity(outbreakData);
      // 2 diseases + 1 variance bonus = 3
      expect(complexity).toBe(3);
    });
  });
});
