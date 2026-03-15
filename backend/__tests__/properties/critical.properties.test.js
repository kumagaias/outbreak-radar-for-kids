/**
 * Critical Property-Based Tests for Backend Lambda
 * 
 * **Validates: Requirements 5.3, 5.9, 5.11, 13.6, 13.7, 16.6**
 * 
 * Category: Critical (run every commit, ~55s)
 * 
 * These tests validate critical invariants that must hold for all inputs:
 * - PII detection and rejection
 * - Cache key uniqueness and collision resistance
 * - Geographic anonymization correctness
 */

const fc = require('fast-check');
const DataAnonymizer = require('../../lib/data-anonymizer');
const SharedCacheManager = require('../../lib/shared-cache-manager');

// Mock DynamoDB for cache manager tests
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Test configuration
const PBT_CONFIG = {
  numRuns: 100,
  verbose: false
};

describe('Critical Properties - PII Detection', () => {
  let dataAnonymizer;

  beforeEach(() => {
    dataAnonymizer = new DataAnonymizer();
  });

  /**
   * Property: PII in request is always rejected
   * 
   * Tests that any request containing PII (name, address, exact age, ward/county)
   * is rejected by the trust boundary validation.
   */
  it('Property: Requests with granular location data are rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.constantFrom(
          'Nerima Ward, Tokyo, JP',
          'Setagaya Ward, Tokyo, JP',
          'Los Angeles County, California, US',
          'Orange County, California, US',
          'Shibuya District, Tokyo, JP'
        ),
        (ageRange, riskLevel, language, granularLocation) => {
          const request = {
            ageRange,
            geographicArea: granularLocation,
            riskLevel,
            language,
            diseaseNames: ['RSV'],
            outbreakData: []
          };

          const validation = dataAnonymizer.validateNoPII(request);

          // Granular location should be rejected
          expect(validation.isValid).toBe(false);
          expect(validation.errors.some(e => e.includes('too granular'))).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Valid prefecture/state-level requests are accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.constantFrom(
          'Tokyo, JP',
          'Osaka, JP',
          'California, US',
          'New York, US',
          'Kyoto, JP'
        ),
        (ageRange, riskLevel, language, validLocation) => {
          const request = {
            ageRange,
            geographicArea: validLocation,
            riskLevel,
            language,
            diseaseNames: ['RSV'],
            outbreakData: []
          };

          const validation = dataAnonymizer.validateNoPII(request);

          // Valid prefecture/state-level location should be accepted
          expect(validation.isValid).toBe(true);
          expect(validation.errors).toHaveLength(0);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Unexpected properties in request are rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('name', 'address', 'dateOfBirth', 'email', 'phone', 'exactAge'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (piiField, piiValue) => {
          const request = {
            ageRange: '2-3',
            geographicArea: 'Tokyo, JP',
            riskLevel: 'medium',
            language: 'ja',
            diseaseNames: ['RSV'],
            outbreakData: [],
            [piiField]: piiValue // Add PII field
          };

          const validation = dataAnonymizer.validateNoPII(request);

          // Request with unexpected PII field should be rejected
          expect(validation.isValid).toBe(false);
          expect(validation.errors.some(e => e.includes('Unexpected property'))).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Invalid age ranges are rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '0-2', '3-5', '6-8', 'infant', 'toddler'),
        (invalidAgeRange) => {
          const request = {
            ageRange: invalidAgeRange,
            geographicArea: 'Tokyo, JP',
            riskLevel: 'medium',
            language: 'ja',
            diseaseNames: ['RSV'],
            outbreakData: []
          };

          const validation = dataAnonymizer.validateNoPII(request);

          // Invalid age range should be rejected
          expect(validation.isValid).toBe(false);
          expect(validation.errors.some(e => e.includes('Invalid ageRange'))).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Invalid risk levels are rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('critical', 'severe', 'minimal', 'none', 'HIGH', 'MEDIUM', 'LOW'),
        (invalidRiskLevel) => {
          const request = {
            ageRange: '2-3',
            geographicArea: 'Tokyo, JP',
            riskLevel: invalidRiskLevel,
            language: 'ja',
            diseaseNames: ['RSV'],
            outbreakData: []
          };

          const validation = dataAnonymizer.validateNoPII(request);

          // Invalid risk level should be rejected
          expect(validation.isValid).toBe(false);
          expect(validation.errors.some(e => e.includes('Invalid riskLevel'))).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Invalid languages are rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('jp', 'english', 'japanese', 'es', 'fr', 'de', 'zh'),
        (invalidLanguage) => {
          const request = {
            ageRange: '2-3',
            geographicArea: 'Tokyo, JP',
            riskLevel: 'medium',
            language: invalidLanguage,
            diseaseNames: ['RSV'],
            outbreakData: []
          };

          const validation = dataAnonymizer.validateNoPII(request);

          // Invalid language should be rejected
          expect(validation.isValid).toBe(false);
          expect(validation.errors.some(e => e.includes('Invalid language'))).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Critical Properties - Geographic Anonymization', () => {
  let dataAnonymizer;

  beforeEach(() => {
    dataAnonymizer = new DataAnonymizer();
  });

  /**
   * Property: Geographic anonymization always produces prefecture/state level
   * 
   * Tests that anonymizeLocation() always strips ward/county/district information
   * and returns only prefecture/state and country code.
   */
  it('Property: Ward/county information is always stripped', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Nerima Ward, Tokyo, JP',
          'Setagaya Ward, Tokyo, JP',
          'Los Angeles County, California, US',
          'Orange County, California, US',
          'Shibuya District, Tokyo, JP',
          'Manhattan, New York, US'
        ),
        (granularLocation) => {
          const anonymized = dataAnonymizer.anonymizeLocation(granularLocation);

          // Anonymized location should not contain ward/county/district
          expect(anonymized).not.toMatch(/ward/i);
          expect(anonymized).not.toMatch(/county/i);
          expect(anonymized).not.toMatch(/district/i);

          // Should contain prefecture/state and country code
          const parts = anonymized.split(',').map(p => p.trim());
          expect(parts.length).toBe(2);
          expect(parts[1]).toMatch(/^[A-Z]{2}$/); // Country code
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Already anonymized locations remain unchanged', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Tokyo, JP',
          'Osaka, JP',
          'California, US',
          'New York, US',
          'Kyoto, JP'
        ),
        (prefectureLevel) => {
          const anonymized = dataAnonymizer.anonymizeLocation(prefectureLevel);

          // Already anonymized location should remain unchanged
          expect(anonymized).toBe(prefectureLevel);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Anonymization is idempotent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Nerima Ward, Tokyo, JP',
          'Los Angeles County, California, US',
          'Tokyo, JP',
          'California, US'
        ),
        (location) => {
          const anonymized1 = dataAnonymizer.anonymizeLocation(location);
          const anonymized2 = dataAnonymizer.anonymizeLocation(anonymized1);

          // Applying anonymization twice should produce same result
          expect(anonymized1).toBe(anonymized2);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Critical Properties - Cache Key Uniqueness', () => {
  let cacheManager;

  beforeEach(() => {
    // Mock DynamoDB client
    cacheManager = new SharedCacheManager('test-table', 'us-east-1');
  });

  /**
   * Property: Different inputs produce different cache keys
   * 
   * Tests that cache key generation is collision-resistant and produces
   * unique keys for different input combinations.
   */
  it('Property: Different age ranges produce different cache keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (ageRange1, ageRange2, location) => {
          fc.pre(ageRange1 !== ageRange2); // Only test different age ranges

          const outbreakData = [
            { diseaseName: 'RSV', severity: 7, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const key1 = cacheManager.generateCacheKey(location, ageRange1, outbreakData);
          const key2 = cacheManager.generateCacheKey(location, ageRange2, outbreakData);

          // Different age ranges should produce different cache keys
          expect(key1).not.toBe(key2);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Different locations produce different cache keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        (location1, location2, ageRange) => {
          fc.pre(location1 !== location2); // Only test different locations

          const outbreakData = [
            { diseaseName: 'RSV', severity: 7, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const key1 = cacheManager.generateCacheKey(location1, ageRange, outbreakData);
          const key2 = cacheManager.generateCacheKey(location2, ageRange, outbreakData);

          // Different locations should produce different cache keys
          expect(key1).not.toBe(key2);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Different outbreak data produces different cache keys', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Tokyo, JP', 'Osaka, JP'),
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
        fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
        fc.integer({ min: 4, max: 9 }),
        (location, ageRange, disease1, disease2, severity) => {
          fc.pre(disease1 !== disease2); // Only test different diseases

          const outbreakData1 = [
            { diseaseName: disease1, severity, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const outbreakData2 = [
            { diseaseName: disease2, severity, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const key1 = cacheManager.generateCacheKey(location, ageRange, outbreakData1);
          const key2 = cacheManager.generateCacheKey(location, ageRange, outbreakData2);

          // Different outbreak data should produce different cache keys
          expect(key1).not.toBe(key2);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Same inputs always produce same cache key (deterministic)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
        fc.integer({ min: 4, max: 9 }),
        (location, ageRange, disease, severity) => {
          const outbreakData = [
            { diseaseName: disease, severity, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const key1 = cacheManager.generateCacheKey(location, ageRange, outbreakData);
          const key2 = cacheManager.generateCacheKey(location, ageRange, outbreakData);

          // Same inputs should always produce same cache key
          expect(key1).toBe(key2);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Cache key is based on disease names, not severity', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Tokyo, JP', 'Osaka, JP'),
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        fc.integer({ min: 4, max: 9 }),
        fc.integer({ min: 4, max: 9 }),
        (location, ageRange, severity1, severity2) => {
          fc.pre(severity1 !== severity2); // Only test different severities

          const outbreakData1 = [
            { diseaseName: 'RSV', severity: severity1, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const outbreakData2 = [
            { diseaseName: 'RSV', severity: severity2, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const key1 = cacheManager.generateCacheKey(location, ageRange, outbreakData1);
          const key2 = cacheManager.generateCacheKey(location, ageRange, outbreakData2);

          // Same disease name with different severity should produce SAME cache key
          // This is correct behavior - cache is based on which diseases are present
          expect(key1).toBe(key2);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Cache key handles empty outbreak data consistently', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        fc.constantFrom('0-1', '2-3', '4-6', '7+'),
        (location, ageRange) => {
          const emptyOutbreakData = [];

          const key1 = cacheManager.generateCacheKey(location, ageRange, emptyOutbreakData);
          const key2 = cacheManager.generateCacheKey(location, ageRange, emptyOutbreakData);

          // Empty outbreak data should produce consistent cache key
          expect(key1).toBe(key2);
          expect(key1).toBeTruthy();
        }
      ),
      PBT_CONFIG
    );
  });
});
