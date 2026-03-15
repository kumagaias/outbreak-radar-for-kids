/**
 * Test generators (arbitraries) for property-based testing
 */

import * as fc from 'fast-check';
import {
  AgeRange,
  GeographicUnit,
  OutbreakData,
  ChildProfile,
  RiskLevel
} from '../types';

/**
 * PBT Configuration
 */
export const PBT_CONFIG = {
  numRuns: 100,
  timeout: 10000, // 10 seconds per test
  verbose: false
};

/**
 * Generate random AgeRange
 */
export function ageRangeArbitrary(): fc.Arbitrary<AgeRange> {
  return fc.constantFrom(
    AgeRange.INFANT,
    AgeRange.TODDLER,
    AgeRange.PRESCHOOL,
    AgeRange.SCHOOL_AGE
  );
}

/**
 * Generate random GeographicUnit
 */
export function geographicUnitArbitrary(): fc.Arbitrary<GeographicUnit> {
  return fc.record({
    country: fc.constantFrom('JP', 'US'),
    stateOrPrefecture: fc.constantFrom(
      'Tokyo',
      'Osaka',
      'California',
      'New York',
      'Florida'
    ),
    countyOrWard: fc.option(
      fc.constantFrom(
        'Nerima',
        'Shibuya',
        'Setagaya',
        'Los Angeles',
        'San Francisco',
        'Manhattan'
      ),
      { nil: undefined }
    )
  });
}

/**
 * Generate random OutbreakData
 */
export function outbreakDataArbitrary(): fc.Arbitrary<OutbreakData> {
  return fc.record({
    diseaseId: fc.uuid(),
    diseaseName: fc.constantFrom(
      'RSV',
      'Influenza',
      'Hand-Foot-Mouth Disease',
      'Norovirus',
      'COVID-19',
      'Strep Throat'
    ),
    severity: fc.integer({ min: 1, max: 10 }),
    geographicUnit: geographicUnitArbitrary(),
    affectedAgeRanges: fc.array(ageRangeArbitrary(), { minLength: 1, maxLength: 4 }),
    reportedCases: fc.integer({ min: 1, max: 10000 }),
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() })
  });
}

/**
 * Generate array of OutbreakData
 */
export function outbreakDataArrayArbitrary(): fc.Arbitrary<OutbreakData[]> {
  return fc.array(outbreakDataArbitrary(), { maxLength: 10 });
}

/**
 * Generate random ChildProfile
 */
export function childProfileArbitrary(): fc.Arbitrary<ChildProfile> {
  return fc.record({
    ageRange: ageRangeArbitrary(),
    location: geographicUnitArbitrary()
  });
}

/**
 * Generate OutbreakData with specific severity
 */
export function outbreakDataWithSeverityArbitrary(
  minSeverity: number,
  maxSeverity: number
): fc.Arbitrary<OutbreakData> {
  return fc.record({
    diseaseId: fc.uuid(),
    diseaseName: fc.constantFrom(
      'RSV',
      'Influenza',
      'Hand-Foot-Mouth Disease',
      'Norovirus'
    ),
    severity: fc.integer({ min: minSeverity, max: maxSeverity }),
    geographicUnit: geographicUnitArbitrary(),
    affectedAgeRanges: fc.array(ageRangeArbitrary(), { minLength: 1 }),
    reportedCases: fc.integer({ min: 1, max: 1000 }),
    timestamp: fc.date()
  });
}

/**
 * Generate OutbreakData in specific location
 */
export function outbreakDataInLocationArbitrary(
  location: GeographicUnit
): fc.Arbitrary<OutbreakData> {
  return fc.record({
    diseaseId: fc.uuid(),
    diseaseName: fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
    severity: fc.integer({ min: 1, max: 10 }),
    geographicUnit: fc.constant(location),
    affectedAgeRanges: fc.array(ageRangeArbitrary(), { minLength: 1 }),
    reportedCases: fc.integer({ min: 1, max: 1000 }),
    timestamp: fc.date()
  });
}

/**
 * Generate ChildProfile with specific location
 */
export function childProfileWithLocationArbitrary(
  location: GeographicUnit
): fc.Arbitrary<ChildProfile> {
  return fc.record({
    ageRange: ageRangeArbitrary(),
    location: fc.constant(location)
  });
}
