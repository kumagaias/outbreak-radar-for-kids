/**
 * Tests for Delphi Epidata FluView Data Fetcher
 * Requirements: 19.4, 19.8, 19.20
 */

const {
  parseFluViewRecord,
  getHHSRegion,
  dateToEpiweek,
  HHS_REGIONS
} = require('../src/sources/fluview');

describe('FluView Data Fetcher', () => {
  describe('parseFluViewRecord', () => {
    test('parses valid FluView record with all fields', () => {
      const record = {
        region: 'hhs1',
        epiweek: 202401,
        year: 2024,
        week: 1,
        weighted_ili: 3.5,
        age_0_4: 4.2,
        age_5_24: 3.1,
        age_25_64: 2.8,
        age_65: 4.5,
        total_patients: 10000,
        ili: 350,
        lag: 1
      };

      const result = parseFluViewRecord(record);

      expect(result).toEqual({
        region: 'hhs1',
        epiweek: 202401,
        year: 2024,
        week: 1,
        iliPercentage: 3.5,
        ageGroups: {
          '0-4': 4.2,
          '5-24': 3.1,
          '25-64': 2.8,
          '65+': 4.5
        },
        totalPatients: 10000,
        iliPatients: 350,
        lag: 1
      });
    });

    test('parses record without age group data', () => {
      const record = {
        region: 'nat',
        epiweek: 202401,
        year: 2024,
        week: 1,
        weighted_ili: 2.8
      };

      const result = parseFluViewRecord(record);

      expect(result).toEqual({
        region: 'nat',
        epiweek: 202401,
        year: 2024,
        week: 1,
        iliPercentage: 2.8,
        ageGroups: null,
        totalPatients: null,
        iliPatients: null,
        lag: null
      });
    });

    test('returns null for record without region', () => {
      const record = {
        epiweek: 202401,
        weighted_ili: 3.5
      };

      const result = parseFluViewRecord(record);
      expect(result).toBeNull();
    });

    test('returns null for record without epiweek', () => {
      const record = {
        region: 'hhs1',
        weighted_ili: 3.5
      };

      const result = parseFluViewRecord(record);
      expect(result).toBeNull();
    });

    test('returns null for record without weighted_ili', () => {
      const record = {
        region: 'hhs1',
        epiweek: 202401
      };

      const result = parseFluViewRecord(record);
      expect(result).toBeNull();
    });

    test('returns null for invalid weighted_ili value', () => {
      const record = {
        region: 'hhs1',
        epiweek: 202401,
        weighted_ili: 'invalid'
      };

      const result = parseFluViewRecord(record);
      expect(result).toBeNull();
    });

    test('handles partial age group data', () => {
      const record = {
        region: 'hhs1',
        epiweek: 202401,
        year: 2024,
        week: 1,
        weighted_ili: 3.5,
        age_0_4: 4.2,
        age_5_24: 3.1
      };

      const result = parseFluViewRecord(record);

      expect(result.ageGroups).toEqual({
        '0-4': 4.2,
        '5-24': 3.1
      });
    });
  });

  describe('getHHSRegion', () => {
    test('returns correct HHS region for California', () => {
      expect(getHHSRegion('CA')).toBe('hhs9');
      expect(getHHSRegion('ca')).toBe('hhs9');
    });

    test('returns correct HHS region for New York', () => {
      expect(getHHSRegion('NY')).toBe('hhs2');
      expect(getHHSRegion('ny')).toBe('hhs2');
    });

    test('returns correct HHS region for Texas', () => {
      expect(getHHSRegion('TX')).toBe('hhs6');
    });

    test('returns null for invalid state', () => {
      expect(getHHSRegion('XX')).toBeNull();
    });

    test('handles all states in HHS_REGIONS', () => {
      const allStates = Object.values(HHS_REGIONS).flat();
      
      allStates.forEach(state => {
        const region = getHHSRegion(state);
        expect(region).toMatch(/^hhs\d+$/);
      });
    });
  });

  describe('dateToEpiweek', () => {
    test('converts date to epiweek format', () => {
      const date = new Date('2024-01-07');
      const epiweek = dateToEpiweek(date);
      
      expect(epiweek).toBeGreaterThanOrEqual(202401);
      expect(epiweek).toBeLessThanOrEqual(202453);
    });

    test('handles year boundary correctly', () => {
      const date = new Date('2024-01-01');
      const epiweek = dateToEpiweek(date);
      
      expect(epiweek).toBeGreaterThanOrEqual(202401);
    });

    test('handles mid-year date', () => {
      const date = new Date('2024-06-15');
      const epiweek = dateToEpiweek(date);
      
      expect(epiweek).toBeGreaterThanOrEqual(202420);
      expect(epiweek).toBeLessThanOrEqual(202430);
    });
  });

  describe('HHS_REGIONS', () => {
    test('contains all 10 HHS regions', () => {
      expect(Object.keys(HHS_REGIONS)).toHaveLength(10);
    });

    test('each region contains valid state codes', () => {
      Object.values(HHS_REGIONS).forEach(states => {
        expect(Array.isArray(states)).toBe(true);
        expect(states.length).toBeGreaterThan(0);
        
        states.forEach(state => {
          expect(state).toMatch(/^[A-Z]{2}$/);
        });
      });
    });

    test('no state appears in multiple regions', () => {
      const allStates = Object.values(HHS_REGIONS).flat();
      const uniqueStates = new Set(allStates);
      
      expect(allStates.length).toBe(uniqueStates.size);
    });

    test('covers all 50 states plus DC', () => {
      const allStates = Object.values(HHS_REGIONS).flat();
      
      // Should have 50 states + DC = 51
      expect(allStates.length).toBe(51);
    });
  });
});
