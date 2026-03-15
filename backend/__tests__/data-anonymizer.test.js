/**
 * Unit tests for DataAnonymizer
 */

const DataAnonymizer = require('../lib/data-anonymizer');

describe('DataAnonymizer', () => {
  let anonymizer;

  beforeEach(() => {
    anonymizer = new DataAnonymizer();
  });

  describe('validateNoPII', () => {
    it('should accept valid request with no PII', () => {
      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja',
        diseaseNames: ['RSV', 'Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(request);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid age range', () => {
      const request = {
        ageRange: '3.5',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja'
      };

      const result = anonymizer.validateNoPII(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('ageRange'))).toBe(true);
    });

    it('should reject location with ward/county', () => {
      const request = {
        ageRange: '2-3',
        geographicArea: 'Nerima Ward, Tokyo, JP',
        riskLevel: 'high',
        language: 'ja'
      };

      const result = anonymizer.validateNoPII(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('granular'))).toBe(true);
    });

    it('should reject invalid geographic area format', () => {
      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo',
        riskLevel: 'high',
        language: 'ja'
      };

      const result = anonymizer.validateNoPII(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('geographicArea'))).toBe(true);
    });

    it('should reject unexpected properties', () => {
      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja',
        childName: 'Test Child' // Unexpected property
      };

      const result = anonymizer.validateNoPII(request);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unexpected property'))).toBe(true);
    });
  });

  describe('isLocationTooGranular', () => {
    it('should detect ward in location', () => {
      expect(anonymizer.isLocationTooGranular('Nerima Ward, Tokyo')).toBe(true);
    });

    it('should detect county in location', () => {
      expect(anonymizer.isLocationTooGranular('Los Angeles County, California')).toBe(true);
    });

    it('should detect postal code', () => {
      expect(anonymizer.isLocationTooGranular('123-4567')).toBe(true);
    });

    it('should accept prefecture/state level', () => {
      expect(anonymizer.isLocationTooGranular('Tokyo, JP')).toBe(false);
      expect(anonymizer.isLocationTooGranular('California, US')).toBe(false);
    });
  });

  describe('anonymizeLocation', () => {
    it('should remove ward from location', () => {
      const result = anonymizer.anonymizeLocation('Nerima Ward, Tokyo, JP');
      expect(result).toBe('Tokyo, JP');
    });

    it('should remove county from location', () => {
      const result = anonymizer.anonymizeLocation('Los Angeles County, California, US');
      expect(result).toBe('California, US');
    });

    it('should keep prefecture/state level unchanged', () => {
      const result = anonymizer.anonymizeLocation('Tokyo, JP');
      expect(result).toBe('Tokyo, JP');
    });
  });

  describe('filterOutbreakData', () => {
    it('should filter by region', () => {
      const outbreakData = [
        {
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['0-1']
        },
        {
          diseaseName: 'Influenza',
          severity: 6,
          geographicUnit: { stateOrPrefecture: 'Osaka' },
          affectedAgeRanges: ['2-3']
        }
      ];

      const result = anonymizer.filterOutbreakData(outbreakData, 'Tokyo, JP');
      expect(result).toHaveLength(1);
      expect(result[0].diseaseName).toBe('RSV');
    });

    it('should filter by severity (exclude < 4)', () => {
      const outbreakData = [
        {
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['0-1']
        },
        {
          diseaseName: 'Common Cold',
          severity: 2,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['2-3']
        }
      ];

      const result = anonymizer.filterOutbreakData(outbreakData, 'Tokyo, JP');
      expect(result).toHaveLength(1);
      expect(result[0].diseaseName).toBe('RSV');
    });

    it('should limit to top 5 outbreaks', () => {
      const outbreakData = Array.from({ length: 10 }, (_, i) => ({
        diseaseName: `Disease${i}`,
        severity: 10 - i,
        geographicUnit: { stateOrPrefecture: 'Tokyo' },
        affectedAgeRanges: ['0-1']
      }));

      const result = anonymizer.filterOutbreakData(outbreakData, 'Tokyo, JP');
      expect(result).toHaveLength(5);
      expect(result[0].diseaseName).toBe('Disease0'); // Highest severity
    });

    it('should remove unnecessary fields', () => {
      const outbreakData = [
        {
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: ['0-1'],
          reportedCases: 150,
          timestamp: new Date()
        }
      ];

      const result = anonymizer.filterOutbreakData(outbreakData, 'Tokyo, JP');
      expect(result[0]).toHaveProperty('diseaseName');
      expect(result[0]).toHaveProperty('severity');
      expect(result[0]).toHaveProperty('affectedAgeRanges');
      expect(result[0]).not.toHaveProperty('reportedCases');
      expect(result[0]).not.toHaveProperty('timestamp');
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact sensitive fields', () => {
      const data = {
        name: 'Test Child',
        address: '123 Main St',
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP'
      };

      const result = anonymizer.sanitizeForLogging(data);
      expect(result.name).toBe('[REDACTED]');
      expect(result.address).toBe('[REDACTED]');
      expect(result.ageRange).toBe('2-3');
      expect(result.geographicArea).toBe('Tokyo, JP');
    });

    it('should anonymize location fields', () => {
      const data = {
        location: 'Nerima Ward, Tokyo, JP',
        geographicArea: 'Nerima Ward, Tokyo, JP'
      };

      const result = anonymizer.sanitizeForLogging(data);
      expect(result.location).toBe('Tokyo, JP');
      expect(result.geographicArea).toBe('Tokyo, JP');
    });
  });
});
