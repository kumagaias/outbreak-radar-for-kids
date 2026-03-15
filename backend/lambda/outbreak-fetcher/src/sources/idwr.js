/**
 * IDWR (Infectious Disease Weekly Report) HTML Data Fetcher
 * 
 * Fetches weekly infectious disease reports from JIHS (Japan Institute for Health Security)
 * Data source: IDWR (https://id-info.jihs.go.jp/surveillance/idwr/)
 * Method: HTML scraping (no API key required)
 * 
 * Requirements: 19.26, 19.33
 * Note: HTML format may vary - robust parsing is critical
 */

const https = require('https');

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
 * Fetch IDWR HTML data with redirect following
 * @param {Object} options - Fetch options
 * @param {number} options.year - Year (e.g., 2025)
 * @param {number} options.week - Week number (1-52)
 * @param {number} maxRedirects - Maximum number of redirects to follow
 * @returns {Promise<string>} HTML data as string
 */
async function fetchIDWRData(options = {}, maxRedirects = 5) {
  const { year, week } = options;
  
  if (!year || !week) {
    throw new Error('year and week parameters are required');
  }
  
  // Construct URL for HTML page
  const weekStr = week.toString().padStart(2, '0');
  const url = `${IDWR_BASE_URL}/${year}/${weekStr}/index.html`;
  
  console.log(`Fetching IDWR data from: ${url}`);
  
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
          reject(new Error(`HTTP ${res.statusCode}: Not Found`));
          return;
        }
        
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const htmlData = buffer.toString('utf-8');
            
            if (!htmlData || htmlData.trim().length === 0) {
              reject(new Error('Empty HTML response'));
              return;
            }
            
            resolve(htmlData);
          } catch (error) {
            reject(new Error(`Failed to decode IDWR HTML: ${error.message}`));
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
 * Parse IDWR HTML data to extract disease case counts
 * @param {string} htmlData - HTML data as string
 * @returns {Array<Object>} Parsed records
 */
function parseIDWRHTML(htmlData) {
  if (!htmlData || typeof htmlData !== 'string') {
    return [];
  }
  
  const records = [];
  
  // Extract disease data from HTML tables
  // IDWR uses tables with disease names and case counts by prefecture
  
  // Simple regex-based extraction (more robust than full HTML parsing for this use case)
  // Look for patterns like: <td>RSウイルス感染症</td><td>123</td>
  
  const diseasePatterns = [
    { ja: 'RSウイルス感染症', en: 'RSV' },
    { ja: 'インフルエンザ', en: 'Influenza' },
    { ja: '手足口病', en: 'Hand-Foot-Mouth Disease' },
    { ja: 'ヘルパンギーナ', en: 'Herpangina' },
    { ja: '感染性胃腸炎', en: 'Norovirus' },
    { ja: '新型コロナウイルス感染症', en: 'COVID-19' },
    { ja: '麻疹', en: 'Measles' }
  ];
  
  // Extract national-level data (total cases)
  for (const disease of diseasePatterns) {
    // Look for disease name followed by case count
    const regex = new RegExp(`${disease.ja}[\\s\\S]{0,500}?<td[^>]*>([\\d,]+)</td>`, 'g');
    const matches = [...htmlData.matchAll(regex)];
    
    if (matches.length > 0) {
      // Take the first match (usually national total)
      const caseCountStr = matches[0][1].replace(/,/g, '');
      const caseCount = parseInt(caseCountStr) || 0;
      
      if (caseCount > 0) {
        records.push({
          disease: disease.en,
          diseaseJa: disease.ja,
          prefecture: 'National',
          caseCount: caseCount
        });
      }
    }
  }
  
  return records;
}

/**
 * Parse CSV line (handles quoted fields) - kept for backward compatibility
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
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
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
      console.log(`Attempting to fetch IDWR data for ${currentYear}-W${currentWeek}...`);
      const htmlData = await fetchIDWRData({ year: currentYear, week: currentWeek });
      const records = parseIDWRHTML(htmlData);
      
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
  parseIDWRHTML,
  parseCSVLine,
  normalizeIDWRRecord,
  fetchWeekData,
  DISEASE_MAPPING
};
