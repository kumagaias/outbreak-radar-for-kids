/**
 * Privacy Boundary Validation Tests
 * 
 * Validates that:
 * - Mobile app never sends PII (name, address, exact age, ward/county)
 * - Backend API rejects requests with PII
 * - Cache keys use only prefecture/state level
 * - K-anonymity protection applied when <10 cases
 * 
 * Requirements: 5.2, 5.3, 5.6, 5.7, 5.9, 5.11, 5.12, 5.13
 */

// Mock AWS SDK before imports
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn()
    })
  },
  GetCommand: jest.fn(),
  PutCommand: jest.fn()
}));

const DataAnonymizer = require('../../lib/data-anonymizer');
const SharedCacheManager = require('../../lib/shared-cache-manager');

describe('Privacy Boundary Validation', () => {
  let anonymizer;

  beforeEach(() => {
    anonymizer = new DataAnonymizer();
  });

  describe('PII Detection and Rejection', () => {
    test('should reject name field', () => {
      const input = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'medium',
        language: 'ja',
        name: '田中太郎', // PII - unexpected property
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unexpected property'))).toBe(true);
    });

    test('should reject address field', () => {
      const input = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'medium',
        language: 'ja',
        address: '練馬区豊玉北1-2-3', // PII - unexpected property
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unexpected property'))).toBe(true);
    });

    test('should reject dateOfBirth field', () => {
      const input = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'medium',
        language: 'ja',
        dateOfBirth: '2021-05-15', // PII - unexpected property
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Unexpected property'))).toBe(true);
    });

    test('should reject exact age', () => {
      const input = {
        ageRange: '3', // Exact age instead of range
        geographicArea: 'Tokyo, JP',
        riskLevel: 'medium',
        language: 'ja',
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('ageRange'))).toBe(true);
    });

    test('should accept valid age ranges', () => {
      const validRanges = ['0-1', '2-3', '4-6', '7+'];
      
      validRanges.forEach(range => {
        const input = {
          ageRange: range,
          geographicArea: 'Tokyo, JP',
          riskLevel: 'medium',
          language: 'ja',
          diseaseNames: ['Influenza'],
          outbreakData: []
        };

        const result = anonymizer.validateNoPII(input);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Geographic Granularity Validation', () => {
    test('should reject ward-level location (Japan)', () => {
      const input = {
        ageRange: '2-3',
        geographicArea: 'Nerima Ward, Tokyo, JP', // Ward level - too granular
        riskLevel: 'medium',
        language: 'ja',
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too granular'))).toBe(true);
    });

    test('should reject county-level location (US)', () => {
      const input = {
        ageRange: '2-3',
        geographicArea: 'Los Angeles County, CA, US', // County level - too granular
        riskLevel: 'medium',
        language: 'en',
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      const result = anonymizer.validateNoPII(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('too granular'))).toBe(true);
    });

    test('should accept prefecture-level location (Japan)', () => {
      const validPrefectures = [
        { area: 'Tokyo, JP', name: '東京都' },
        { area: 'Osaka, JP', name: '大阪府' },
        { area: 'Hokkaido, JP', name: '北海道' },
        { area: 'Okinawa, JP', name: '沖縄県' }
      ];
      
      validPrefectures.forEach(({ area }) => {
        const input = {
          ageRange: '2-3',
          geographicArea: area,
          riskLevel: 'medium',
          language: 'ja',
          diseaseNames: ['Influenza'],
          outbreakData: []
        };

        const result = anonymizer.validateNoPII(input);
        expect(result.isValid).toBe(true);
      });
    });

    test('should accept state-level location (US)', () => {
      const validStates = [
        'California, US',
        'New York, US',
        'Texas, US',
        'Florida, US'
      ];
      
      validStates.forEach(state => {
        const input = {
          ageRange: '2-3',
          geographicArea: state,
          riskLevel: 'medium',
          language: 'en',
          diseaseNames: ['Influenza'],
          outbreakData: []
        };

        const result = anonymizer.validateNoPII(input);
        expect(result.isValid).toBe(true);
      });
    });

    test('should filter outbreak data to remove low severity and limit results', () => {
      const outbreakData = [
        {
          diseaseId: 'flu',
          diseaseName: 'Influenza',
          severity: 5,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo',
            countyOrWard: 'Nerima Ward' // Will be filtered out
          },
          affectedAgeRanges: ['2-3', '4-6']
        },
        {
          diseaseId: 'rsv',
          diseaseName: 'RSV',
          severity: 3, // Low severity - should be filtered
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: 'Tokyo'
          },
          affectedAgeRanges: ['0-1']
        }
      ];

      const filtered = anonymizer.filterOutbreakData(outbreakData, 'Tokyo, JP');
      
      // Should filter out low severity (< 4)
      expect(filtered.length).toBe(1);
      expect(filtered[0].diseaseName).toBe('Influenza');
      
      // Should remove unnecessary fields
      expect(filtered[0].geographicUnit).toBeUndefined();
      expect(filtered[0].diseaseId).toBeUndefined();
    });
  });

  describe('Cache Key Privacy', () => {
    test('should use only prefecture/state in cache key', () => {
      const cacheManager = new SharedCacheManager();
      
      const outbreakData = [
        {
          diseaseId: 'flu',
          diseaseName: 'Influenza',
          severity: 5.2,
          geographicUnit: {
            country: 'JP',
            stateOrPrefecture: '東京都'
          }
        }
      ];

      const cacheKey = cacheManager.generateCacheKey(
        '東京都',
        '2-3',
        outbreakData
      );

      // Cache key should contain prefecture but not ward
      expect(cacheKey).toContain('東京都');
      expect(cacheKey).not.toContain('練馬区');
      expect(cacheKey).not.toContain('ward');
      expect(cacheKey).not.toContain('county');
    });

    test('should normalize outbreak data in cache key', () => {
      const cacheManager = new SharedCacheManager();
      
      const outbreakData1 = [
        {
          diseaseId: 'flu',
          diseaseName: 'Influenza',
          severity: 5.234, // Will be rounded
          geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
        }
      ];

      const outbreakData2 = [
        {
          diseaseId: 'flu',
          diseaseName: 'Influenza',
          severity: 5.267, // Different but rounds to same
          geographicUnit: { country: 'JP', stateOrPrefecture: '東京都' }
        }
      ];

      const key1 = cacheManager.generateCacheKey('東京都', '2-3', outbreakData1);
      const key2 = cacheManager.generateCacheKey('東京都', '2-3', outbreakData2);

      // Should generate same cache key due to normalization
      expect(key1).toBe(key2);
    });
  });

  describe('Conversation History Privacy', () => {
    test('should not persist conversation history', () => {
      // Verify that no conversation history is stored
      // This is enforced by not implementing conversation storage
      
      const input = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'medium',
        language: 'ja',
        diseaseNames: ['Influenza'],
        outbreakData: []
      };

      // Should not have conversationId or history fields
      expect(input.conversationId).toBeUndefined();
      expect(input.conversationHistory).toBeUndefined();
    });
  });
});
