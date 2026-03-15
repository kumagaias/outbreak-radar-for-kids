/**
 * Tests for IDWR Historical Mock Data
 */

const {
  generateMockIDWRData,
  generateMultiPrefectureData,
  getSeason,
  getSeasonalMultiplier,
  getWeekNumber,
  normalizePrefectureName,
  getPrefecturePopulationFactor,
  MAJOR_PREFECTURES
} = require('../src/mock-data/idwr-historical');

describe('IDWR Historical Mock Data', () => {
  describe('generateMockIDWRData', () => {
    it('should generate national-level mock data', () => {
      const data = generateMockIDWRData();
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Check first record structure
      const record = data[0];
      expect(record).toHaveProperty('disease');
      expect(record).toHaveProperty('diseaseJa');
      expect(record).toHaveProperty('prefecture');
      expect(record).toHaveProperty('caseCount');
      expect(record).toHaveProperty('reportWeek');
      expect(record).toHaveProperty('reportYear');
      expect(record).toHaveProperty('source', 'mock-idwr-historical');
      expect(record).toHaveProperty('timestamp');
      
      // National data should have 'National' as prefecture
      expect(record.prefecture).toBe('National');
    });
    
    it('should generate prefecture-specific mock data', () => {
      const data = generateMockIDWRData({ prefecture: 'Tokyo' });
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // All records should be for Tokyo
      data.forEach(record => {
        expect(record.prefecture).toBe('東京都');
      });
    });
    
    it('should generate data for specific date', () => {
      const targetDate = new Date('2024-02-15');
      const data = generateMockIDWRData({ date: targetDate });
      
      expect(data.length).toBeGreaterThan(0);
      
      // Check year and week
      const record = data[0];
      expect(record.reportYear).toBe(2024);
      expect(record.reportWeek).toBeGreaterThan(0);
      expect(record.reportWeek).toBeLessThanOrEqual(53);
    });
    
    it('should include all major diseases', () => {
      const data = generateMockIDWRData();
      
      const diseases = data.map(r => r.disease);
      
      expect(diseases).toContain('RSV');
      expect(diseases).toContain('Influenza');
      expect(diseases).toContain('Hand-Foot-Mouth Disease');
      expect(diseases).toContain('Herpangina');
      expect(diseases).toContain('Norovirus');
      expect(diseases).toContain('COVID-19');
    });
    
    it('should apply seasonal patterns correctly', () => {
      // Winter date (January)
      const winterDate = new Date('2024-01-15');
      const winterData = generateMockIDWRData({ date: winterDate });
      
      // Summer date (July)
      const summerDate = new Date('2024-07-15');
      const summerData = generateMockIDWRData({ date: summerDate });
      
      // RSV should be higher in winter
      const winterRSV = winterData.find(r => r.disease === 'RSV');
      const summerRSV = summerData.find(r => r.disease === 'RSV');
      
      expect(winterRSV.caseCount).toBeGreaterThan(summerRSV.caseCount);
      
      // Hand-Foot-Mouth should be higher in summer
      const winterHFMD = winterData.find(r => r.disease === 'Hand-Foot-Mouth Disease');
      const summerHFMD = summerData.find(r => r.disease === 'Hand-Foot-Mouth Disease');
      
      expect(summerHFMD.caseCount).toBeGreaterThan(winterHFMD.caseCount);
    });
    
    it('should apply prefecture population factors', () => {
      const tokyoData = generateMockIDWRData({ prefecture: 'Tokyo' });
      const smallPrefData = generateMockIDWRData({ prefecture: 'Tottori' });
      
      // Tokyo should have higher case counts due to population
      const tokyoRSV = tokyoData.find(r => r.disease === 'RSV');
      const smallPrefRSV = smallPrefData.find(r => r.disease === 'RSV');
      
      expect(tokyoRSV.caseCount).toBeGreaterThan(smallPrefRSV.caseCount);
    });
  });
  
  describe('generateMultiPrefectureData', () => {
    it('should generate data for multiple prefectures', () => {
      const prefectures = ['Tokyo', 'Osaka', 'Kanagawa'];
      const data = generateMultiPrefectureData(prefectures);
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Should have data for all prefectures
      const uniquePrefectures = [...new Set(data.map(r => r.prefecture))];
      expect(uniquePrefectures.length).toBe(3);
      expect(uniquePrefectures).toContain('東京都');
      expect(uniquePrefectures).toContain('大阪府');
      expect(uniquePrefectures).toContain('神奈川県');
    });
    
    it('should use MAJOR_PREFECTURES constant', () => {
      const data = generateMultiPrefectureData(MAJOR_PREFECTURES);
      
      expect(data.length).toBeGreaterThan(0);
      
      // Should have data for all major prefectures
      const uniquePrefectures = [...new Set(data.map(r => r.prefecture))];
      expect(uniquePrefectures.length).toBe(MAJOR_PREFECTURES.length);
    });
  });
  
  describe('getSeason', () => {
    it('should return correct season for each month', () => {
      expect(getSeason(1)).toBe('winter');
      expect(getSeason(2)).toBe('winter');
      expect(getSeason(3)).toBe('spring');
      expect(getSeason(4)).toBe('spring');
      expect(getSeason(5)).toBe('spring');
      expect(getSeason(6)).toBe('summer');
      expect(getSeason(7)).toBe('summer');
      expect(getSeason(8)).toBe('summer');
      expect(getSeason(9)).toBe('fall');
      expect(getSeason(10)).toBe('fall');
      expect(getSeason(11)).toBe('fall');
      expect(getSeason(12)).toBe('winter');
    });
  });
  
  describe('getSeasonalMultiplier', () => {
    it('should return high multiplier for winter diseases in winter', () => {
      const multiplier = getSeasonalMultiplier('winter', 'winter');
      expect(multiplier).toBe(3.0);
    });
    
    it('should return low multiplier for winter diseases in summer', () => {
      const multiplier = getSeasonalMultiplier('summer', 'winter');
      expect(multiplier).toBe(0.3);
    });
    
    it('should return high multiplier for summer diseases in summer', () => {
      const multiplier = getSeasonalMultiplier('summer', 'summer');
      expect(multiplier).toBe(3.0);
    });
    
    it('should return consistent multiplier for year-round diseases', () => {
      expect(getSeasonalMultiplier('spring', 'year-round')).toBe(1.0);
      expect(getSeasonalMultiplier('summer', 'year-round')).toBe(1.0);
      expect(getSeasonalMultiplier('fall', 'year-round')).toBe(1.0);
      expect(getSeasonalMultiplier('winter', 'year-round')).toBe(1.0);
    });
  });
  
  describe('getWeekNumber', () => {
    it('should return week 1 for early January', () => {
      const date = new Date('2024-01-05');
      const week = getWeekNumber(date);
      expect(week).toBe(1);
    });
    
    it('should return week number in valid range', () => {
      const date = new Date('2024-06-15');
      const week = getWeekNumber(date);
      expect(week).toBeGreaterThan(0);
      expect(week).toBeLessThanOrEqual(53);
    });
  });
  
  describe('normalizePrefectureName', () => {
    it('should convert English prefecture names to Japanese', () => {
      expect(normalizePrefectureName('Tokyo')).toBe('東京都');
      expect(normalizePrefectureName('Osaka')).toBe('大阪府');
      expect(normalizePrefectureName('Kanagawa')).toBe('神奈川県');
    });
    
    it('should return Japanese names as-is', () => {
      expect(normalizePrefectureName('東京都')).toBe('東京都');
      expect(normalizePrefectureName('大阪府')).toBe('大阪府');
    });
    
    it('should handle unknown prefecture names', () => {
      const result = normalizePrefectureName('UnknownPrefecture');
      expect(result).toBe('UnknownPrefecture');
    });
  });
  
  describe('getPrefecturePopulationFactor', () => {
    it('should return higher factor for Tokyo', () => {
      const factor = getPrefecturePopulationFactor('東京都');
      expect(factor).toBe(1.5);
    });
    
    it('should return lower factor for smaller prefectures', () => {
      const factor = getPrefecturePopulationFactor('静岡県');
      expect(factor).toBe(0.7);
    });
    
    it('should return default factor for unknown prefectures', () => {
      const factor = getPrefecturePopulationFactor('Unknown');
      expect(factor).toBe(0.5);
    });
  });
  
  describe('MAJOR_PREFECTURES', () => {
    it('should contain 10 major prefectures', () => {
      expect(MAJOR_PREFECTURES.length).toBe(10);
    });
    
    it('should include Tokyo and Osaka', () => {
      expect(MAJOR_PREFECTURES).toContain('東京都');
      expect(MAJOR_PREFECTURES).toContain('大阪府');
    });
  });
});
