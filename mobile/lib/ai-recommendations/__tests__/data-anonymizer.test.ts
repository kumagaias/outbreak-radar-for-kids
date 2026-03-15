/**
 * Unit tests for DataAnonymizer
 * Feature: nova-ai-recommendations
 */

import { DataAnonymizer } from '../data-anonymizer';
import { PIIDetectedError, LocationTooGranularError } from '../errors';
import { ChildProfile, OutbreakData, AgeRange, GeographicUnit } from '../types';

describe('DataAnonymizer', () => {
  let anonymizer: DataAnonymizer;

  beforeEach(() => {
    anonymizer = new DataAnonymizer();
  });

  describe('anonymizeForNovaService', () => {
    /**
     * Test exact age is not transmitted (3.5 years → 2-3 years)
     * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
     */
    it('should not transmit exact age (3.5 years → 2-3 years)', () => {
      const childProfile: ChildProfile = {
        id: 'child-123',
        name: 'Test Child',
        dateOfBirth: new Date('2021-05-15'),
        exactAge: 3.5,
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Nerima'
        }
      };

      const outbreakData: OutbreakData[] = [];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Verify age range is transmitted (not exact age)
      expect(anonymized.ageRange).toBe(AgeRange.TODDLER);
      expect(anonymized.ageRange).toBe('2-3');

      // Verify exact age is not in anonymized data
      const anonymizedObj = anonymized as any;
      expect(anonymizedObj.exactAge).toBeUndefined();
    });

    /**
     * Test child name is not transmitted
     * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
     */
    it('should not transmit child name', () => {
      const childProfile: ChildProfile = {
        id: 'child-123',
        name: 'Test Child',
        ageRange: AgeRange.INFANT,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const outbreakData: OutbreakData[] = [];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Verify name is not in anonymized data
      const anonymizedObj = anonymized as any;
      expect(anonymizedObj.name).toBeUndefined();
      expect(anonymizedObj.id).toBeUndefined();
    });

    /**
     * Test ward/county is not transmitted (Nerima Ward → Tokyo)
     * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
     */
    it('should not transmit ward/county (Nerima Ward → Tokyo)', () => {
      const childProfile: ChildProfile = {
        ageRange: AgeRange.PRESCHOOL,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo',
          countyOrWard: 'Nerima'
        }
      };

      const outbreakData: OutbreakData[] = [];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Verify geographic area is prefecture/state level only
      expect(anonymized.geographicArea).toBe('Tokyo, JP');
      expect(anonymized.geographicArea).not.toContain('Nerima');
    });

    /**
     * Test date of birth is not transmitted
     * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
     */
    it('should not transmit date of birth', () => {
      const childProfile: ChildProfile = {
        id: 'child-123',
        name: 'Test Child',
        dateOfBirth: new Date('2021-05-15'),
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'US',
          stateOrPrefecture: 'California'
        }
      };

      const outbreakData: OutbreakData[] = [];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Verify date of birth is not in anonymized data
      const anonymizedObj = anonymized as any;
      expect(anonymizedObj.dateOfBirth).toBeUndefined();
    });

    /**
     * Test address is not transmitted
     * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
     */
    it('should not transmit address', () => {
      const childProfile: ChildProfile = {
        id: 'child-123',
        name: 'Test Child',
        ageRange: AgeRange.SCHOOL_AGE,
        location: {
          country: 'US',
          stateOrPrefecture: 'New York',
          countyOrWard: 'Manhattan'
        }
      };

      const outbreakData: OutbreakData[] = [];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Verify address/ward is not in anonymized data
      expect(anonymized.geographicArea).toBe('New York, US');
      expect(anonymized.geographicArea).not.toContain('Manhattan');
    });

    /**
     * Test US county is not transmitted (Los Angeles County → California)
     */
    it('should not transmit US county (Los Angeles County → California)', () => {
      const childProfile: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'US',
          stateOrPrefecture: 'California',
          countyOrWard: 'Los Angeles'
        }
      };

      const outbreakData: OutbreakData[] = [];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Verify geographic area is state level only
      expect(anonymized.geographicArea).toBe('California, US');
      expect(anonymized.geographicArea).not.toContain('Los Angeles');
    });
  });

  describe('validateNoPII', () => {
    it('should pass for valid payload with no PII', () => {
      const validPayload = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja'
      };

      expect(() => anonymizer.validateNoPII(validPayload)).not.toThrow();
    });

    it('should throw PIIDetectedError for payload with exact age', () => {
      const payloadWithExactAge = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        exactAge: 3.5
      };

      expect(() => anonymizer.validateNoPII(payloadWithExactAge)).toThrow(PIIDetectedError);
    });

    it('should throw PIIDetectedError for payload with name', () => {
      const payloadWithName = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        name: 'John Doe'
      };

      expect(() => anonymizer.validateNoPII(payloadWithName)).toThrow(PIIDetectedError);
    });

    it('should throw PIIDetectedError for payload with Japanese postal code', () => {
      const payloadWithPostalCode = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        diseaseNames: ['RSV', '123-4567']
      };

      expect(() => anonymizer.validateNoPII(payloadWithPostalCode)).toThrow(PIIDetectedError);
    });

    it('should throw PIIDetectedError for payload with US ZIP code', () => {
      const payloadWithZip = {
        ageRange: '4-6',
        geographicArea: 'California, US',
        diseaseNames: ['Influenza', '12345']
      };

      expect(() => anonymizer.validateNoPII(payloadWithZip)).toThrow(PIIDetectedError);
    });

    it('should throw PIIDetectedError for payload with date of birth pattern', () => {
      const payloadWithDOB = {
        ageRange: '0-1',
        geographicArea: 'New York, US',
        diseaseNames: ['RSV', '05/15/2021']
      };

      expect(() => anonymizer.validateNoPII(payloadWithDOB)).toThrow(PIIDetectedError);
    });

    it('should throw PIIDetectedError for invalid age range value', () => {
      const payloadWithInvalidAge = {
        ageRange: '3.5 years',
        geographicArea: 'Tokyo, JP'
      };

      expect(() => anonymizer.validateNoPII(payloadWithInvalidAge)).toThrow(PIIDetectedError);
    });

    it('should throw PIIDetectedError for invalid geographic area format', () => {
      const payloadWithInvalidGeo = {
        ageRange: '2-3',
        geographicArea: 'Nerima Ward, Tokyo, JP'
      };

      expect(() => anonymizer.validateNoPII(payloadWithInvalidGeo)).toThrow(PIIDetectedError);
    });
  });

  describe('isLocationTooGranular', () => {
    it('should detect ward as too granular', () => {
      expect(anonymizer.isLocationTooGranular('Nerima Ward, Tokyo')).toBe(true);
      expect(anonymizer.isLocationTooGranular('Shibuya Ward')).toBe(true);
    });

    it('should detect county as too granular', () => {
      expect(anonymizer.isLocationTooGranular('Los Angeles County, California')).toBe(true);
      expect(anonymizer.isLocationTooGranular('San Francisco County')).toBe(true);
    });

    it('should detect district as too granular', () => {
      expect(anonymizer.isLocationTooGranular('Central District')).toBe(true);
    });

    it('should detect Japanese postal code as too granular', () => {
      expect(anonymizer.isLocationTooGranular('123-4567')).toBe(true);
    });

    it('should detect US ZIP code as too granular', () => {
      expect(anonymizer.isLocationTooGranular('12345')).toBe(true);
      expect(anonymizer.isLocationTooGranular('12345-6789')).toBe(true);
    });

    it('should detect street address as too granular', () => {
      expect(anonymizer.isLocationTooGranular('123 Main Street')).toBe(true);
      expect(anonymizer.isLocationTooGranular('456 Park Avenue')).toBe(true);
    });

    it('should detect Japanese ward names as too granular', () => {
      expect(anonymizer.isLocationTooGranular('練馬区')).toBe(true);
      expect(anonymizer.isLocationTooGranular('渋谷区')).toBe(true);
    });

    it('should not detect prefecture/state as too granular', () => {
      expect(anonymizer.isLocationTooGranular('Tokyo, JP')).toBe(false);
      expect(anonymizer.isLocationTooGranular('California, US')).toBe(false);
      expect(anonymizer.isLocationTooGranular('New York, US')).toBe(false);
    });
  });

  describe('validateLocationGranularity', () => {
    it('should throw LocationTooGranularError for location with ward', () => {
      const locationWithWard: GeographicUnit = {
        country: 'JP',
        stateOrPrefecture: 'Tokyo',
        countyOrWard: 'Nerima'
      };

      expect(() => anonymizer.validateLocationGranularity(locationWithWard)).toThrow(
        LocationTooGranularError
      );
    });

    it('should throw LocationTooGranularError for location with county', () => {
      const locationWithCounty: GeographicUnit = {
        country: 'US',
        stateOrPrefecture: 'California',
        countyOrWard: 'Los Angeles'
      };

      expect(() => anonymizer.validateLocationGranularity(locationWithCounty)).toThrow(
        LocationTooGranularError
      );
    });

    it('should not throw for location without ward/county', () => {
      const locationWithoutWard: GeographicUnit = {
        country: 'JP',
        stateOrPrefecture: 'Tokyo'
      };

      expect(() => anonymizer.validateLocationGranularity(locationWithoutWard)).not.toThrow();
    });

    it('should not throw for US state without county', () => {
      const locationWithoutCounty: GeographicUnit = {
        country: 'US',
        stateOrPrefecture: 'California'
      };

      expect(() => anonymizer.validateLocationGranularity(locationWithoutCounty)).not.toThrow();
    });
  });

  describe('filterOutbreakData', () => {
    it('should filter outbreak data by prefecture/state', () => {
      const childProfile: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 150,
          timestamp: new Date()
        },
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 6,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Osaka' },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 100,
          timestamp: new Date()
        }
      ];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Should only include Tokyo outbreak
      expect(anonymized.filteredOutbreakData).toHaveLength(1);
      expect(anonymized.filteredOutbreakData[0].diseaseName).toBe('RSV');
    });

    it('should exclude low severity outbreaks (< 4)', () => {
      const childProfile: ChildProfile = {
        ageRange: AgeRange.PRESCHOOL,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const outbreakData: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 150,
          timestamp: new Date()
        },
        {
          diseaseId: 'cold-001',
          diseaseName: 'Common Cold',
          severity: 2,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.PRESCHOOL],
          reportedCases: 50,
          timestamp: new Date()
        }
      ];

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Should only include high severity outbreak
      expect(anonymized.filteredOutbreakData).toHaveLength(1);
      expect(anonymized.filteredOutbreakData[0].diseaseName).toBe('RSV');
    });

    it('should limit to max 5 outbreaks sorted by severity', () => {
      const childProfile: ChildProfile = {
        ageRange: AgeRange.TODDLER,
        location: {
          country: 'JP',
          stateOrPrefecture: 'Tokyo'
        }
      };

      const outbreakData: OutbreakData[] = Array.from({ length: 10 }, (_, i) => ({
        diseaseId: `disease-${i}`,
        diseaseName: `Disease ${i}`,
        severity: i + 1, // Severity 1-10
        geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
        affectedAgeRanges: [AgeRange.TODDLER],
        reportedCases: 100,
        timestamp: new Date()
      }));

      const anonymized = anonymizer.anonymizeForNovaService(childProfile, outbreakData);

      // Should limit to 5 outbreaks
      expect(anonymized.filteredOutbreakData).toHaveLength(5);

      // Should be sorted by severity (highest first)
      expect(anonymized.filteredOutbreakData[0].severity).toBe(10);
      expect(anonymized.filteredOutbreakData[1].severity).toBe(9);
      expect(anonymized.filteredOutbreakData[2].severity).toBe(8);
      expect(anonymized.filteredOutbreakData[3].severity).toBe(7);
      expect(anonymized.filteredOutbreakData[4].severity).toBe(6);
    });
  });
});
