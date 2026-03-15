/**
 * IDWR (Infectious Disease Weekly Report) CSV Data Fetcher
 * 
 * Fetches weekly infectious disease reports from JIHS (Japan Institute for Health Security)
 * Data source: IDWR (https://id-info.jihs.go.jp/surveillance/idwr/)
 * Method: CSV download (Shift-JIS encoded)
 * 
 * Requirements: 19.26, 19.33
 * Note: CSV files are Shift-JIS encoded and require proper decoding
 */

const https = require('https');
const iconv = require('iconv-lite');

const IDWR_BASE_URL = 'https://id-info.jihs.go.jp/surveillance/idwr/provisional';
const TIMEOUT_MS = 15000;  // Longer timeout for Japan data sources

// Disease name mapping (Japanese to English)
const DISEASE_MAPPING = {
  'RSウイルス感染症': 'RSV',
  'インフルエンザ': 'Influenza',
  '手足口病': 'Hand-Foot-Mouth Disease',
  'ヘルパンギーナ': 'Herpangina',
  '感染性胃腸炎': 'Norovirus',  // Reported as infectious gastroenteritis
  '新型コロナウイルス感染症': 'COVID-19',
  '麻疹': 'Measles',
  'サル痘': 'Mpox'
};

/**
 * Fetch IDWR CSV data with redirect following and Shift-JIS decoding
 * @param {Object} options - Fetch options
 * @param {number} options.year - Year (e.g., 2025)
 * @param {number} options.week - Week number (1-52)
 * @param {number} maxRedirects - Maximum number of redirects to follow
 * @returns {Promise<string>} CSV data as UTF-8 string
 */
async function fetchIDWRData(options = {}, maxRedirects = 5) {
  const { year, week } = options;
  
  if (!year || !week) {
    throw new Error('year and week parameters are required');
  }
  
  // Construct URL for CSV file (定点把握疾患 - sentinel surveillance diseases)
  const weekStr = week.toString().padStart(2, '0');
  const url = `${IDWR_BASE_URL}/${year}/${weekStr}/${year}-${weekStr}-teiten.csv`;
  
  console.log(`Fetching IDWR CSV from: ${url}`);
  
  return new Promise((resolve, reject) => {
    let redirectCount = 0;
    
    const makeRequest = (requestUrl) => {
      const req = https.get(requestUrl, (res) => {
        // Handle redirects (301, 302, 303, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          
          if (redirectCount > maxRedirects) {
            reject(new Error(`Too many redirects (${redirectCount})`));
            return;
          }
          
          console.log(`Following redirect to: ${res.headers.location}`);
          makeRequest(res.headers.location);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: CSV file not found`));
          return;
        }
        
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            
            // Decode from Shift-JIS to UTF-8
            const csvData = iconv.decode(buffer, 'shift-jis');
            
            if (!csvData || csvData.trim().length === 0) {
              reject(new Error('Empty CSV response'));
              return;
            }
            
            resolve(csvData);
          } catch (error) {
            reject(new Error(`Failed to decode IDWR CSV: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`IDWR request failed: ${error.message}`));
      });
      
      req.setTimeout(TIMEOUT_MS, () => {
        req.destroy();
        reject(new Error('IDWR request timeout'));
      });
    };
    
    makeRequest(url);
  });
}

/**
 * Parse IDWR CSV data to extract disease case counts
 * @param {string} csvData - CSV data as UTF-8 string
 * @returns {Array<Object>} Parsed records
 */
function parseIDWRCSV(csvData) {
  if (!csvData || typeof csvData !== 'string') {
    return [];
  }
  
  const records = [];
  const lines = csvData.split('\n');
  
  if (lines.length < 5) {
    return records;
  }
  
  // Parse header row (row 3) to find disease column indices
  const headerLine = lines[2]; // 3rd row contains disease names
  const headers = parseCSVLine(headerLine);
  
  // Disease name mapping (Japanese to English)
  const diseaseMapping = {
    'インフルエンザ': 'Influenza',
    'ＲＳウイルス感染症': 'RSV',
    '手足口病': 'Hand-Foot-Mouth Disease',
    'ヘルパンギーナ': 'Herpangina',
    '感染性胃腸炎': 'Norovirus',
    'COVID-19': 'COVID-19',
    '麻疹': 'Measles'
  };
  
  // Find column indices for each disease (報告 = report count)
  const diseaseColumns = {};
  headers.forEach((header, index) => {
    const diseaseName = header.trim();
    if (diseaseMapping[diseaseName]) {
      // Next column should be "報告" (report count)
      diseaseColumns[diseaseMapping[diseaseName]] = {
        nameIndex: index,
        countIndex: index + 1,
        nameJa: diseaseName
      };
    }
  });
  
  // Parse data rows (starting from row 5 - row 4 is sub-headers)
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 2) continue;
    
    const prefecture = values[0].replace(/"/g, '').trim();
    if (!prefecture || prefecture === '総数') continue; // Skip total row
    
    // Extract case counts for each disease
    for (const [diseaseEn, colInfo] of Object.entries(diseaseColumns)) {
      const countStr = values[colInfo.countIndex];
      if (!countStr || countStr === '-' || countStr === '""') continue;
      
      const caseCount = parseInt(countStr.replace(/,/g, '').replace(/"/g, '')) || 0;
      
      if (caseCount > 0) {
        records.push({
          disease: diseaseEn,
          diseaseJa: colInfo.nameJa,
          prefecture: prefecture,
          caseCount: caseCount
        });
      }
    }
  }
  
  return records;
}

/**
 * Parse CSV line (handles quoted fields)
 * @param {string} line - CSV line
 * @returns {Array<string>} Parsed values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * Normalize IDWR record to standard format
 * @param {Object} record - Raw IDWR record
 * @param {number} year - Year
 * @param {number} week - Week number
 * @returns {Object|null} Normalized record or null if invalid
 */
function normalizeIDWRRecord(record, year, week) {
  if (!record || !record.disease) {
    return null;
  }
  
  return {
    disease: record.disease,
    diseaseJa: record.diseaseJa,
    prefecture: record.prefecture || 'National',
    caseCount: record.caseCount || 0,
    reportWeek: week,
    reportYear: year
  };
}

/**
 * Fetch and parse IDWR data for a specific week with fallback
 * @param {number} year - Year
 * @param {number} week - Week number
 * @param {number} maxFallbackWeeks - Maximum number of weeks to fall back
 * @returns {Promise<Array>} Array of normalized records
 */
async function fetchWeekData(year, week, maxFallbackWeeks = 4) {
  let currentYear = year;
  let currentWeek = week;
  let lastError = null;
  
  // Try current week and up to maxFallbackWeeks previous weeks
  for (let i = 0; i <= maxFallbackWeeks; i++) {
    try {
      console.log(`Attempting to fetch IDWR CSV for ${currentYear}-W${currentWeek}...`);
      const csvData = await fetchIDWRData({ year: currentYear, week: currentWeek });
      const records = parseIDWRCSV(csvData);
      
      if (records.length > 0) {
        console.log(`Successfully fetched ${records.length} records for ${currentYear}-W${currentWeek}`);
        return records
          .map(record => normalizeIDWRRecord(record, currentYear, currentWeek))
          .filter(record => record !== null);
      }
      
      console.warn(`No data found for ${currentYear}-W${currentWeek}, trying previous week...`);
    } catch (error) {
      lastError = error;
      console.warn(`Failed to fetch ${currentYear}-W${currentWeek}: ${error.message}`);
    }
    
    // Move to previous week
    currentWeek--;
    if (currentWeek < 1) {
      currentWeek = 52;
      currentYear--;
    }
  }
  
  // All attempts failed
  throw new Error(`Failed to fetch IDWR data after ${maxFallbackWeeks + 1} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
  fetchIDWRData,
  parseIDWRCSV,
  parseCSVLine,
  normalizeIDWRRecord,
  fetchWeekData,
  DISEASE_MAPPING
};
