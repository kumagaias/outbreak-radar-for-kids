/**
 * Unit tests for FluSurv-NET data fetcher
 * 
 * Tests data fetching, parsing, and age-specific rate mapping
 */

const {
  parseFluSurvRecord,
  getAgeSpecificRate,
  filterChildAgeGroups,
  dateToEpiweek,
  getRecentEpiweeksRange,
  AGE_GROUPS,
  CHILD_AGE_GROUPS,
  DISEASE_MAPPING
} = require('../src/sources/flusurv');

describe('FluSurv-NET Data Fetcher', () => {
  describe('parseFluSurvRecord', () => {
    it('should parse valid FluSurv-NET record with all age groups', () => {
      const record = {
        location: 'network_all',
        epiweek: 202401,
        year: 2024,
        week: 1,
        rate_age_0_1: 5.2,
        rate_age_1_4: 3.8,
        rate_age_5_11: 2.1,
        rate_age_12_17: 1.5,
        rate_age_18_49: 0.8,
        rate_age_50_64: 1.2,
        rate_age_65_: 4.5,
        rate_overall: 2.3,
        lag: 1
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).not.toBeNull();
      expect(parsed.location).toBe('network_all');
      expect(parsed.epiweek).toBe(202401);
      expect(parsed.year).toBe(2024);
      expect(parsed.week).toBe(1);
      expect(parsed.ageGroupRates['0-1']).toBe(5.2);
      expect(parsed.ageGroupRates['1-4']).toBe(3.8);
      expect(parsed.ageGroupRates['5-11']).toBe(2.1);
      expect(parsed.ageGroupRates['12-17']).toBe(1.5);
      expect(parsed.overallRate).toBe(2.3);
      expect(parsed.lag).toBe(1);
    });
    
    it('should parse record with only child age groups', () => {
      const record = {
        location: 'ca',
        epiweek: 202402,
        year: 2024,
        week: 2,
        rate_age_0_1: 6.5,
        rate_age_1_4: 4.2,
        rate_overall: 2.5
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).not.toBeNull();
      expect(parsed.ageGroupRates['0-1']).toBe(6.5);
      expect(parsed.ageGroupRates['1-4']).toBe(4.2);
      expect(Object.keys(parsed.ageGroupRates).length).toBe(2);
    });
    
    it('should return null for record without location', () => {
      const record = {
        epiweek: 202401,
        rate_age_0_1: 5.2
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).toBeNull();
    });
    
    it('should return null for record without epiweek', () => {
      const record = {
        location: 'network_all',
        rate_age_0_1: 5.2
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).toBeNull();
    });
    
    it('should return null for record without any age group data', () => {
      const record = {
        location: 'network_all',
        epiweek: 202401,
        rate_overall: 2.3
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).toBeNull();
    });
    
    it('should handle negative rates by skipping them', () => {
      const record = {
        location: 'network_all',
        epiweek: 202401,
        rate_age_0_1: -1.0,  // Invalid negative rate
        rate_age_1_4: 3.8
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).not.toBeNull();
      expect(parsed.ageGroupRates['0-1']).toBeUndefined();
      expect(parsed.ageGroupRates['1-4']).toBe(3.8);
    });
    
    it('should handle NaN rates by skipping them', () => {
      const record = {
        location: 'network_all',
        epiweek: 202401,
        rate_age_0_1: 'invalid',
        rate_age_1_4: 3.8
      };
      
      const parsed = parseFluSurvRecord(record);
      
      expect(parsed).not.toBeNull();
      expect(parsed.ageGroupRates['0-1']).toBeUndefined();
      expect(parsed.ageGroupRates['1-4']).toBe(3.8);
    });
  });
  
  describe('getAgeSpecificRate', () => {
    const ageGroupRates = {
      '0-1': 5.2,
      '1-4': 3.8,
      '5-11': 2.1,
      '12-17': 1.5,
      '18-49': 0.8
    };
    
    it('should map app age range 0-1 to FluSurv-NET 0-1', () => {
      const rate = getAgeSpecificRate(ageGroupRates, '0-1');
      expect(rate).toBe(5.2);
    });
    
    it('should map app age range 2-3 to FluSurv-NET 1-4', () => {
      const rate = getAgeSpecificRate(ageGroupRates, '2-3');
      expect(rate).toBe(3.8);
    });
    
    it('should map app age range 4-6 to FluSurv-NET 5-11', () => {
      const rate = getAgeSpecificRate(ageGroupRates, '4-6');
      expect(rate).toBe(2.1);
    });
    
    it('should map app age range 7+ to FluSurv-NET 12-17 when available', () => {
      const rate = getAgeSpecificRate(ageGroupRates, '7+');
      expect(rate).toBe(1.5);  // Prefers 12-17 over 5-11
    });
    
    it('should fall back to 5-11 for app age range 7+ when 12-17 unavailable', () => {
      const limitedRates = {
        '0-1': 5.2,
        '1-4': 3.8,
        '5-11': 2.1
      };
      
      const rate = getAgeSpecificRate(limitedRates, '7+');
      expect(rate).toBe(2.1);  // Falls back to 5-11
    });
    
    it('should return null for invalid app age range', () => {
      const rate = getAgeSpecificRate(ageGroupRates, 'invalid');
      expect(rate).toBeNull();
    });
    
    it('should return null when mapped age group is not available', () => {
      const limitedRates = {
        '18-49': 0.8
      };
      
      const rate = getAgeSpecificRate(limitedRates, '0-1');
      expect(rate).toBeNull();
    });
  });
  
  describe('filterChildAgeGroups', () => {
    it('should keep records with child age group data', () => {
      const records = [
        {
          location: 'network_all',
          epiweek: 202401,
          ageGroupRates: { '0-1': 5.2, '1-4': 3.8 }
        },
        {
          location: 'network_all',
          epiweek: 202402,
          ageGroupRates: { '5-11': 2.1, '12-17': 1.5 }
        }
      ];
      
      const filtered = filterChildAgeGroups(records);
      
      expect(filtered.length).toBe(2);
    });
    
    it('should filter out records without child age group data', () => {
      const records = [
        {
          location: 'network_all',
          epiweek: 202401,
          ageGroupRates: { '0-1': 5.2, '1-4': 3.8 }
        },
        {
          location: 'network_all',
          epiweek: 202402,
          ageGroupRates: { '18-49': 0.8, '50-64': 1.2 }  // No child data
        }
      ];
      
      const filtered = filterChildAgeGroups(records);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].epiweek).toBe(202401);
    });
    
    it('should return empty array when no records have child data', () => {
      const records = [
        {
          location: 'network_all',
          epiweek: 202401,
          ageGroupRates: { '18-49': 0.8, '50-64': 1.2 }
        }
      ];
      
      const filtered = filterChildAgeGroups(records);
      
      expect(filtered.length).toBe(0);
    });
  });
  
  describe('dateToEpiweek', () => {
    it('should convert date to epiweek format', () => {
      const date = new Date('2024-01-15');
      const epiweek = dateToEpiweek(date);
      
      expect(epiweek).toBeGreaterThanOrEqual(202401);
      expect(epiweek).toBeLessThanOrEqual(202453);
    });
    
    it('should handle year boundary correctly', () => {
      const date = new Date('2024-01-01');
      const epiweek = dateToEpiweek(date);
      
      expect(epiweek).toBeGreaterThanOrEqual(202401);
      expect(epiweek).toBeLessThan(202410);
    });
  });
  
  describe('getRecentEpiweeksRange', () => {
    it('should return epiweeks range for last 4 weeks by default', () => {
      const range = getRecentEpiweeksRange();
      
      expect(range).toMatch(/^\d{6}-\d{6}$/);
      
      const [start, end] = range.split('-').map(Number);
      expect(end).toBeGreaterThanOrEqual(start);
    });
    
    it('should return epiweeks range for specified weeks back', () => {
      const range = getRecentEpiweeksRange(8);
      
      expect(range).toMatch(/^\d{6}-\d{6}$/);
      
      const [start, end] = range.split('-').map(Number);
      expect(end).toBeGreaterThanOrEqual(start);
    });
  });
  
  describe('Constants', () => {
    it('should define all age groups', () => {
      expect(AGE_GROUPS).toBeDefined();
      expect(Object.keys(AGE_GROUPS).length).toBe(7);
      expect(AGE_GROUPS['0-1']).toBe('0-1 yr');
      expect(AGE_GROUPS['1-4']).toBe('1-4 yr');
      expect(AGE_GROUPS['5-11']).toBe('5-11 yr');
      expect(AGE_GROUPS['12-17']).toBe('12-17 yr');
    });
    
    it('should define child age groups (under 18)', () => {
      expect(CHILD_AGE_GROUPS).toBeDefined();
      expect(CHILD_AGE_GROUPS.length).toBe(4);
      expect(CHILD_AGE_GROUPS).toContain('0-1');
      expect(CHILD_AGE_GROUPS).toContain('1-4');
      expect(CHILD_AGE_GROUPS).toContain('5-11');
      expect(CHILD_AGE_GROUPS).toContain('12-17');
    });
    
    it('should define disease mapping', () => {
      expect(DISEASE_MAPPING).toBeDefined();
      expect(DISEASE_MAPPING['flu_a']).toBe('Influenza A');
      expect(DISEASE_MAPPING['flu_b']).toBe('Influenza B');
    });
  });
});
