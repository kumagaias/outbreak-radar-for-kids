/**
 * IDWR Historical Mock Data
 * 
 * Pre-seeded mock data based on historical IDWR patterns from NIID
 * Used as fallback when real IDWR data is unavailable
 * 
 * Data patterns based on:
 * - Typical seasonal trends (RSV: fall/winter, Hand-Foot-Mouth: summer)
 * - Historical case counts from 2023-2024 IDWR reports
 * - Geographic distribution across major prefectures
 * 
 * Requirements: 19.30
 * Note: This is realistic mock data for MVP - replace with real data when IDWR access is restored
 */

/**
 * Generate mock IDWR data for current week
 * @param {Object} options - Generation options
 * @param {string} [options.prefecture] - Prefecture name (Japanese or English)
 * @param {Date} [options.date] - Target date (defaults to current date)
 * @returns {Array<Object>} Mock IDWR records
 */
function generateMockIDWRData(options = {}) {
  const { prefecture, date = new Date() } = options;
  
  // Determine current season for realistic patterns
  const month = date.getMonth() + 1;  // 1-12
  const season = getSeason(month);
  
  // Get week number
  const weekNumber = getWeekNumber(date);
  const year = date.getFullYear();
  
  // Generate data for all major diseases
  const diseases = [
    {
      diseaseJa: 'RSウイルス感染症',
      disease: 'RSV',
      seasonalPattern: 'fall-winter',
      baselineCount: 150,
      peakMultiplier: 3.0
    },
    {
      diseaseJa: 'インフルエンザ',
      disease: 'Influenza',
      seasonalPattern: 'winter',
      baselineCount: 200,
      peakMultiplier: 5.0
    },
    {
      diseaseJa: '手足口病',
      disease: 'Hand-Foot-Mouth Disease',
      seasonalPattern: 'summer',
      baselineCount: 100,
      peakMultiplier: 4.0
    },
    {
      diseaseJa: 'ヘルパンギーナ',
      disease: 'Herpangina',
      seasonalPattern: 'summer',
      baselineCount: 80,
      peakMultiplier: 3.5
    },
    {
      diseaseJa: '感染性胃腸炎',
      disease: 'Norovirus',
      seasonalPattern: 'winter',
      baselineCount: 300,
      peakMultiplier: 2.5
    },
    {
      diseaseJa: '新型コロナウイルス感染症',
      disease: 'COVID-19',
      seasonalPattern: 'year-round',
      baselineCount: 100,
      peakMultiplier: 2.0
    }
  ];
  
  const records = [];
  
  // Generate data for each disease
  for (const diseaseInfo of diseases) {
    const seasonalMultiplier = getSeasonalMultiplier(season, diseaseInfo.seasonalPattern);
    
    // Calculate case count with seasonal variation
    const baseCaseCount = diseaseInfo.baselineCount * seasonalMultiplier;
    
    // Add random variation (±20%)
    const variation = 0.8 + Math.random() * 0.4;
    const caseCount = Math.round(baseCaseCount * variation);
    
    // If prefecture specified, generate prefecture-specific data
    if (prefecture) {
      const prefectureJa = normalizePrefectureName(prefecture);
      
      records.push({
        disease: diseaseInfo.disease,
        diseaseJa: diseaseInfo.diseaseJa,
        prefecture: prefectureJa,
        caseCount: Math.round(caseCount * getPrefecturePopulationFactor(prefectureJa)),
        reportWeek: weekNumber,
        reportYear: year,
        source: 'mock-idwr-historical',
        timestamp: date.toISOString()
      });
    } else {
      // Generate national-level data
      records.push({
        disease: diseaseInfo.disease,
        diseaseJa: diseaseInfo.diseaseJa,
        prefecture: 'National',
        caseCount: caseCount,
        reportWeek: weekNumber,
        reportYear: year,
        source: 'mock-idwr-historical',
        timestamp: date.toISOString()
      });
    }
  }
  
  return records;
}

/**
 * Generate mock data for multiple prefectures
 * @param {Array<string>} prefectures - Prefecture names
 * @param {Date} [date] - Target date
 * @returns {Array<Object>} Mock IDWR records for all prefectures
 */
function generateMultiPrefectureData(prefectures, date = new Date()) {
  const allRecords = [];
  
  for (const prefecture of prefectures) {
    const records = generateMockIDWRData({ prefecture, date });
    allRecords.push(...records);
  }
  
  return allRecords;
}

/**
 * Get season from month
 * @param {number} month - Month (1-12)
 * @returns {string} Season name
 */
function getSeason(month) {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Get seasonal multiplier for disease pattern
 * @param {string} currentSeason - Current season
 * @param {string} diseasePattern - Disease seasonal pattern
 * @returns {number} Multiplier (0.5 to 3.0)
 */
function getSeasonalMultiplier(currentSeason, diseasePattern) {
  const patterns = {
    'fall-winter': {
      spring: 0.5,
      summer: 0.3,
      fall: 2.0,
      winter: 3.0
    },
    'winter': {
      spring: 0.6,
      summer: 0.3,
      fall: 1.5,
      winter: 3.0
    },
    'summer': {
      spring: 1.2,
      summer: 3.0,
      fall: 0.8,
      winter: 0.4
    },
    'year-round': {
      spring: 1.0,
      summer: 1.0,
      fall: 1.0,
      winter: 1.0
    }
  };
  
  return patterns[diseasePattern]?.[currentSeason] || 1.0;
}

/**
 * Get week number of year
 * @param {Date} date - Target date
 * @returns {number} Week number (1-53)
 */
function getWeekNumber(date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Normalize prefecture name (handle both Japanese and English)
 * @param {string} prefecture - Prefecture name
 * @returns {string} Normalized Japanese prefecture name
 */
function normalizePrefectureName(prefecture) {
  const prefectureMapping = {
    'Tokyo': '東京都',
    'Osaka': '大阪府',
    'Kanagawa': '神奈川県',
    'Aichi': '愛知県',
    'Saitama': '埼玉県',
    'Chiba': '千葉県',
    'Hyogo': '兵庫県',
    'Hokkaido': '北海道',
    'Fukuoka': '福岡県',
    'Shizuoka': '静岡県'
  };
  
  // If already Japanese, return as-is
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(prefecture)) {
    return prefecture;
  }
  
  // Map English to Japanese
  return prefectureMapping[prefecture] || prefecture;
}

/**
 * Get population factor for prefecture (relative to national average)
 * @param {string} prefectureJa - Prefecture name in Japanese
 * @returns {number} Population factor (0.1 to 1.5)
 */
function getPrefecturePopulationFactor(prefectureJa) {
  const populationFactors = {
    '東京都': 1.5,      // Tokyo (highest population)
    '大阪府': 1.2,      // Osaka
    '神奈川県': 1.3,    // Kanagawa
    '愛知県': 1.1,      // Aichi
    '埼玉県': 1.1,      // Saitama
    '千葉県': 1.0,      // Chiba
    '兵庫県': 0.9,      // Hyogo
    '北海道': 0.8,      // Hokkaido
    '福岡県': 0.9,      // Fukuoka
    '静岡県': 0.7       // Shizuoka
  };
  
  return populationFactors[prefectureJa] || 0.5;  // Default for smaller prefectures
}

/**
 * Major prefectures for multi-prefecture data generation
 */
const MAJOR_PREFECTURES = [
  '東京都',
  '大阪府',
  '神奈川県',
  '愛知県',
  '埼玉県',
  '千葉県',
  '兵庫県',
  '北海道',
  '福岡県',
  '静岡県'
];

module.exports = {
  generateMockIDWRData,
  generateMultiPrefectureData,
  getSeason,
  getSeasonalMultiplier,
  getWeekNumber,
  normalizePrefectureName,
  getPrefecturePopulationFactor,
  MAJOR_PREFECTURES
};
