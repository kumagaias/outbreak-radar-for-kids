/**
 * e-Stat API Data Fetcher
 * 
 * Fetches infectious disease surveillance data from Japan's government statistics portal
 * Data source: e-Stat API (https://www.e-stat.go.jp/)
 * Focus: Norovirus data (reported as "infectious gastroenteritis")
 * 
 * Requirements: 19.27, 14.15
 * Note: e-Stat API requires application ID (appId) registration
 */

const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ESTAT_API_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json';
const TIMEOUT_MS = 10000;  // 10 seconds timeout
const REGION = process.env.AWS_REGION || 'ap-northeast-1';

// Disease name mapping (Japanese to English)
const DISEASE_MAPPING = {
  '感染性胃腸炎': 'Norovirus'  // Reported as infectious gastroenteritis
};

// Prefecture name mapping (Japanese to English)
const PREFECTURE_MAPPING = {
  '北海道': 'Hokkaido',
  '青森県': 'Aomori',
  '岩手県': 'Iwate',
  '宮城県': 'Miyagi',
  '秋田県': 'Akita',
  '山形県': 'Yamagata',
  '福島県': 'Fukushima',
  '茨城県': 'Ibaraki',
  '栃木県': 'Tochigi',
  '群馬県': 'Gunma',
  '埼玉県': 'Saitama',
  '千葉県': 'Chiba',
  '東京都': 'Tokyo',
  '神奈川県': 'Kanagawa',
  '新潟県': 'Niigata',
  '富山県': 'Toyama',
  '石川県': 'Ishikawa',
  '福井県': 'Fukui',
  '山梨県': 'Yamanashi',
  '長野県': 'Nagano',
  '岐阜県': 'Gifu',
  '静岡県': 'Shizuoka',
  '愛知県': 'Aichi',
  '三重県': 'Mie',
  '滋賀県': 'Shiga',
  '京都府': 'Kyoto',
  '大阪府': 'Osaka',
  '兵庫県': 'Hyogo',
  '奈良県': 'Nara',
  '和歌山県': 'Wakayama',
  '鳥取県': 'Tottori',
  '島根県': 'Shimane',
  '岡山県': 'Okayama',
  '広島県': 'Hiroshima',
  '山口県': 'Yamaguchi',
  '徳島県': 'Tokushima',
  '香川県': 'Kagawa',
  '愛媛県': 'Ehime',
  '高知県': 'Kochi',
  '福岡県': 'Fukuoka',
  '佐賀県': 'Saga',
  '長崎県': 'Nagasaki',
  '熊本県': 'Kumamoto',
  '大分県': 'Oita',
  '宮崎県': 'Miyazaki',
  '鹿児島県': 'Kagoshima',
  '沖縄県': 'Okinawa'
};

/**
 * Retrieve e-Stat API application ID from AWS Secrets Manager
 * @returns {Promise<string>} API application ID
 */
async function getEStatAPIKey() {
  const secretName = process.env.ESTAT_SECRET_NAME || 'estat-api-key';
  
  const client = new SecretsManagerClient({ region: REGION });
  
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);
    
    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      const apiKey = secret.appId || secret.apiKey || secret.api_key;
      
      if (!apiKey) {
        throw new Error('Secret does not contain appId, apiKey, or api_key field');
      }
      
      return apiKey;
    }
    
    throw new Error('Secret does not contain SecretString');
  } catch (error) {
    console.error('Failed to retrieve e-Stat API key from Secrets Manager:', error);
    throw new Error(`e-Stat API key retrieval failed: ${error.message}`);
  }
}

/**
 * Fetch data from e-Stat API
 * @param {Object} options - Fetch options
 * @param {string} options.statsDataId - Statistics dataset ID
 * @param {string} [options.cdCat01] - Category code for disease type
 * @param {string} [options.cdArea] - Area code for prefecture
 * @param {number} [options.limit] - Maximum number of records to fetch
 * @returns {Promise<Object>} API response data
 */
async function fetchEStatData(options = {}) {
  const { statsDataId, cdCat01, cdArea, limit = 10000 } = options;
  
  if (!statsDataId) {
    throw new Error('statsDataId parameter is required');
  }
  
  // Get API key from Secrets Manager
  const appId = await getEStatAPIKey();
  
  // Build query parameters
  const params = new URLSearchParams({
    appId: appId,
    statsDataId: statsDataId,
    limit: limit.toString()
  });
  
  if (cdCat01) {
    params.append('cdCat01', cdCat01);
  }
  
  if (cdArea) {
    params.append('cdArea', cdArea);
  }
  
  const url = `${ESTAT_API_BASE}/getStatsData?${params.toString()}`;
  
  console.log(`Fetching e-Stat data: statsDataId=${statsDataId}, cdCat01=${cdCat01 || 'all'}, cdArea=${cdArea || 'all'}`);
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`e-Stat API returned status ${res.statusCode}`));
          return;
        }
        
        try {
          const jsonData = JSON.parse(data);
          
          // Check for API errors
          if (jsonData.GET_STATS_DATA && jsonData.GET_STATS_DATA.RESULT) {
            const result = jsonData.GET_STATS_DATA.RESULT;
            if (result.STATUS !== 0) {
              reject(new Error(`e-Stat API error: ${result.ERROR_MSG || 'Unknown error'}`));
              return;
            }
          }
          
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse e-Stat API response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`e-Stat API request failed: ${error.message}`));
    });
    
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('e-Stat API request timeout'));
    });
  });
}

/**
 * Parse e-Stat API response
 * @param {Object} apiResponse - Raw API response
 * @returns {Array<Object>} Parsed records
 */
function parseEStatResponse(apiResponse) {
  if (!apiResponse || !apiResponse.GET_STATS_DATA) {
    return [];
  }
  
  const statsData = apiResponse.GET_STATS_DATA;
  
  if (!statsData.STATISTICAL_DATA || !statsData.STATISTICAL_DATA.DATA_INF) {
    return [];
  }
  
  const dataInf = statsData.STATISTICAL_DATA.DATA_INF;
  
  // Extract class objects for mapping codes to names
  const classObj = dataInf.CLASS_INF?.CLASS_OBJ || {};
  const valueList = dataInf.VALUE || [];
  
  if (!Array.isArray(valueList) || valueList.length === 0) {
    return [];
  }
  
  // Build mapping dictionaries
  const categoryMap = buildCategoryMap(classObj, '@cat01');  // Disease categories
  const areaMap = buildCategoryMap(classObj, '@area');       // Prefecture/area codes
  const timeMap = buildCategoryMap(classObj, '@time');       // Time periods
  
  // Parse data values
  const records = [];
  
  for (const value of valueList) {
    try {
      const record = {
        diseaseCode: value['@cat01'],
        diseaseName: categoryMap[value['@cat01']] || value['@cat01'],
        areaCode: value['@area'],
        areaName: areaMap[value['@area']] || value['@area'],
        timeCode: value['@time'],
        timePeriod: timeMap[value['@time']] || value['@time'],
        value: value['$'] || '0'
      };
      
      records.push(record);
    } catch (error) {
      console.warn('Error parsing e-Stat record:', error, value);
      // Continue with next record
    }
  }
  
  return records;
}

/**
 * Build category mapping from class object
 * @param {Object} classObj - Class object from API response
 * @param {string} classId - Class ID to extract (e.g., '@cat01', '@area')
 * @returns {Object} Mapping of codes to names
 */
function buildCategoryMap(classObj, classId) {
  const map = {};
  
  if (!classObj || typeof classObj !== 'object') {
    return map;
  }
  
  // Find the class object with matching @id
  let targetClass = null;
  
  if (Array.isArray(classObj)) {
    targetClass = classObj.find(c => c['@id'] === classId);
  } else if (classObj['@id'] === classId) {
    targetClass = classObj;
  }
  
  if (!targetClass || !targetClass.CLASS) {
    return map;
  }
  
  const classList = Array.isArray(targetClass.CLASS) ? targetClass.CLASS : [targetClass.CLASS];
  
  for (const classItem of classList) {
    if (classItem['@code'] && classItem['@name']) {
      map[classItem['@code']] = classItem['@name'];
    }
  }
  
  return map;
}

/**
 * Normalize e-Stat record to standard format
 * @param {Object} record - Raw e-Stat record
 * @returns {Object|null} Normalized record or null if invalid
 */
function normalizeEStatRecord(record) {
  if (!record || !record.diseaseName) {
    return null;
  }
  
  // Map disease name to English
  const diseaseNameEn = DISEASE_MAPPING[record.diseaseName] || record.diseaseName;
  
  // Map prefecture name to English
  const prefectureEn = PREFECTURE_MAPPING[record.areaName] || record.areaName;
  
  // Parse case count
  const caseCount = parseFloat(record.value) || 0;
  
  // Parse time period (format: YYYYWW where WW is week number)
  const timeCode = record.timeCode || record.timePeriod || '';
  const year = parseInt(timeCode.substring(0, 4)) || null;
  const week = parseInt(timeCode.substring(4)) || null;
  
  // Calculate per 100k population (if available in future enhancement)
  // For now, this field is set to null as e-Stat may not provide population-adjusted rates
  const per100kPopulation = null;
  
  return {
    disease: diseaseNameEn,
    diseaseJa: record.diseaseName,
    prefecture: prefectureEn,
    prefectureJa: record.areaName,
    weekNumber: week,
    year: year,
    caseCount: caseCount,
    per100kPopulation: per100kPopulation,
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetch and parse norovirus data for a specific time period
 * @param {Object} options - Fetch options
 * @param {string} options.statsDataId - Statistics dataset ID
 * @param {string} [options.prefecture] - Prefecture name (Japanese)
 * @param {number} [options.year] - Year
 * @param {number} [options.week] - Week number
 * @returns {Promise<Array>} Array of normalized records
 */
async function fetchNorovirusData(options = {}) {
  const { statsDataId, prefecture, year, week } = options;
  
  if (!statsDataId) {
    throw new Error('statsDataId parameter is required');
  }
  
  // Build fetch options
  const fetchOptions = {
    statsDataId: statsDataId
  };
  
  // Add filters if provided
  // Note: Actual filter parameters depend on e-Stat dataset structure
  // These may need adjustment based on the specific dataset being used
  
  const apiResponse = await fetchEStatData(fetchOptions);
  const records = parseEStatResponse(apiResponse);
  
  // Filter records
  let filteredRecords = records;
  
  if (prefecture) {
    filteredRecords = filteredRecords.filter(r => r.areaName === prefecture);
  }
  
  if (year) {
    filteredRecords = filteredRecords.filter(r => {
      const recordYear = parseInt(r.timeCode?.substring(0, 4));
      return recordYear === year;
    });
  }
  
  if (week) {
    filteredRecords = filteredRecords.filter(r => {
      const recordWeek = parseInt(r.timeCode?.substring(4));
      return recordWeek === week;
    });
  }
  
  // Normalize records
  return filteredRecords
    .map(normalizeEStatRecord)
    .filter(record => record !== null);
}

module.exports = {
  fetchEStatData,
  parseEStatResponse,
  buildCategoryMap,
  normalizeEStatRecord,
  fetchNorovirusData,
  getEStatAPIKey,
  DISEASE_MAPPING,
  PREFECTURE_MAPPING
};
