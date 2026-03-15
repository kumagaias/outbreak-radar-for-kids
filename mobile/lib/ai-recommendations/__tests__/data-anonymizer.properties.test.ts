/**
 * Property-based tests for DataAnonymizer
 * Feature: nova-ai-recommendations
 */

import * as fc from 'fast-check';
import { DataAnonymizer } from '../data-anonymizer';
import {
  PBT_CONFIG,
  childProfileArbitrary,
  outbreakDataArrayArbitrary
} from './test-generators';
import { PIIDetectedError, LocationTooGranularError } from '../errors';
import { ChildProfile, GeographicUnit } from '../types';

describe('DataAnonymizer Properties', () => {
  let anonymizer: DataAnonymizer;

  beforeEach(() => {
    anonymizer = new DataAnonymizer();
  });

  /**
   * Property 19: Privacy Data Transmission Restriction
   * Validates: Requirements 5.2, 5.3, 5.5, 5.6, 5.7
   * 
   * For any Nova_Service API call and cache key generation, the request SHALL NOT contain
   * child exact age, name, address, date of birth, or location more granular than
   * prefecture/state level (ward/county must be excluded).
   */
  it('Property 19: Privacy Data Transmission Restriction - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        childProfileArbitrary(),
        outbreakDataArrayArbitrary(),
        async (childProfile, outbreakData) => {
          // Anonymize data
          const anonymized = anonymizer.anonymizeForNovaService(
            childProfile,
            outbreakData
          );

          // Verify age range is transmitted (not exact age)
          expect(anonymized.ageRange).toBeDefined();
          expect(['0-1', '2-3', '4-6', '7+']).toContain(anonymized.ageRange);

          // Verify geographic area is prefecture/state level only
          expect(anonymized.geographicArea).toBeDefined();
          expect(anonymized.geographicArea).toMatch(/^[A-Za-z\s]+,\s[A-Z]{2}$/);

          // Verify no ward/county in geographic area
          expect(anonymized.geographicArea).not.toMatch(/ward/i);
          expect(anonymized.geographicArea).not.toMatch(/county/i);
          expect(anonymized.geographicArea).not.toMatch(/district/i);

          // Verify no PII fields in anonymized data
          const anonymizedObj = anonymized as any;
          expect(anonymizedObj.name).toBeUndefined();
          expect(anonymizedObj.dateOfBirth).toBeUndefined();
          expect(anonymizedObj.exactAge).toBeUndefined();
          expect(anonymizedObj.address).toBeUndefined();

          // Verify filtered outbreak data doesn't contain ward/county
          for (const outbreak of anonymized.filteredOutbreakData) {
            // Ward/county may exist in outbreak data for local risk calculation
            // but should not be transmitted in the anonymized geographic area
            const countyOrWard = outbreak.geographicUnit.countyOrWard || '';
            if (countyOrWard) {
              expect(anonymized.geographicArea).not.toContain(countyOrWard);
            }
          }
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: validateNoPII detects PII in payloads
   * Validates: Requirements 5.2, 5.3, 5.5, 5.6, 5.7
   */
  it('Property: validateNoPII detects PII in payloads - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          ageRange: fc.constantFrom('0-1', '2-3', '4-6', '7+'),
          geographicArea: fc.constantFrom('Tokyo, JP', 'California, US', 'Osaka, JP'),
          riskLevel: fc.constantFrom('high', 'medium', 'low'),
          language: fc.constantFrom('ja', 'en')
        }),
        async (validPayload) => {
          // Valid payload should pass
          expect(() => anonymizer.validateNoPII(validPayload)).not.toThrow();

          // Payload with exact age should fail
          const withExactAge = { ...validPayload, exactAge: 3.5 };
          expect(() => anonymizer.validateNoPII(withExactAge)).toThrow(PIIDetectedError);

          // Payload with name should fail
          const withName = { ...validPayload, name: 'John Doe' };
          expect(() => anonymizer.validateNoPII(withName)).toThrow(PIIDetectedError);

          // Payload with postal code should fail
          const withPostalCode = { ...validPayload, address: '123-4567' };
          expect(() => anonymizer.validateNoPII(withPostalCode)).toThrow(PIIDetectedError);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: isLocationTooGranular detects granular locations
   * Validates: Requirements 5.6, 5.7
   */
  it('Property: isLocationTooGranular detects granular locations - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Nerima Ward, Tokyo',
          'Los Angeles County, California',
          '123-4567',
          '12345',
          '123 Main Street'
        ),
        async (granularLocation) => {
          // Granular locations should be detected
          expect(anonymizer.isLocationTooGranular(granularLocation)).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Prefecture/state level locations are not too granular
   * Validates: Requirements 5.6, 5.7
   */
  it('Property: Prefecture/state level locations are not too granular - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'Tokyo, JP',
          'California, US',
          'New York, US',
          'Osaka, JP',
          'Florida, US'
        ),
        async (prefectureStateLocation) => {
          // Prefecture/state level should not be detected as too granular
          expect(anonymizer.isLocationTooGranular(prefectureStateLocation)).toBe(false);
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: validateLocationGranularity throws error for ward/county
   * Validates: Requirements 5.6, 5.7
   */
  it('Property: validateLocationGranularity throws error for ward/county - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          country: fc.constantFrom('JP', 'US'),
          stateOrPrefecture: fc.constantFrom('Tokyo', 'California'),
          countyOrWard: fc.constantFrom('Nerima', 'Los Angeles')
        }),
        async (locationWithWard) => {
          // Location with ward/county should throw error
          expect(() => anonymizer.validateLocationGranularity(locationWithWard)).toThrow(
            LocationTooGranularError
          );
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: validateLocationGranularity passes for prefecture/state only
   * Validates: Requirements 5.6, 5.7
   */
  it('Property: validateLocationGranularity passes for prefecture/state only - Feature: nova-ai-recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          country: fc.constantFrom('JP', 'US'),
          stateOrPrefecture: fc.constantFrom('Tokyo', 'California', 'New York')
        }),
        async (locationWithoutWard) => {
          // Location without ward/county should not throw error
          expect(() => anonymizer.validateLocationGranularity(locationWithoutWard)).not.toThrow();
        }
      ),
      PBT_CONFIG
    );
  });
});
