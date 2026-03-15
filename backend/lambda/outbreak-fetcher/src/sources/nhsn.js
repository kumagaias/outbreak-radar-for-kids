/**
 * CDC NHSN (National Healthcare Safety Network) Data Fetcher
 * 
 * Fetches weekly hospital respiratory admission data for Influenza, COVID-19, and RSV
 * Data source: CDC NHSN via SODA API
 * Geographic level: State only (no county-level data available)
 * 
 * Requirements: 19.3, 19.7, 19.19
 */

const https = require('https');

const NHSN_ENDPOINT = 'https://data.cdc.gov/resource/mpgq-jmmr.json';
const TIMEOUT_MS = 10000;

// Disease mapping from NHSN to our standard format
const DISEASE_MAPPING = {
  'COVID-19': 'COVID-19',
  'Influenza': 'Influenza',
  'RSV': 'RSV'
};

/**
 * Fetch NHSN hospital admission data
 * @param {Object} options - Fetch options
 * @param {string} options.state - State abbreviation (e.g., 'CA', 'NY')
 * @param {string} [options.startDate] - Optional start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Optional end date (YYYY-MM-DD)
 * @param {string} options.apiKey - Optional SODA API key
 * @returns {Promise<Array>} Array of hospital admission records
 */
async function fetchNHSNData(options = {}) {
  const { state, startDate, endDate, apiKey } = options;
  
  // Build query parameters
  const params = new URLSearchParams();
  // Fetch latest 1000 records (covers several months typically)
  params.append('$limit', '1000');
  
  // Add filters
  const whereConditions = [];
  if (state) {
    whereConditions.push(`jurisdiction = '${state}'`);
  }
  // Only add date filters if explicitly provided
  if (startDate) {
    whereConditions.push(`weekendingdate >= '${startDate}'`);
  }
  if (endDate) {
    whereConditions.push(`weekendingdate <= '${endDate}'`);
  }
  
  if (whereConditions.length > 0) {
    params.append('$where', whereConditions.join(' AND '));
  }
  
  // Sort by date descending
  params.append('$order', 'weekendingdate DESC');
  
  const url = `${NHSN_ENDPOINT}?${params.toString()}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {}
    };
    
    // Add API key if provided
    if (apiKey) {
      options.headers['X-App-Token'] = apiKey;
    }
    
    const req = https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NHSN API returned status ${res.statusCode}`));
          return;
        }
        
        try {
          const records = JSON.parse(data);
          resolve(records);
        } catch (error) {
          reject(new Error(`Failed to parse NHSN response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`NHSN API request failed: ${error.message}`));
    });
    
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('NHSN API request timeout'));
    });
  });
}

/**
 * Parse NHSN record into standardized format
 * @param {Object} record - Raw NHSN record
 * @returns {Object|null} Parsed record or null if invalid
 */
function parseNHSNRecord(record) {
  if (!record || !record.jurisdiction || !record.weekendingdate) {
    return null;
  }
  
  // Extract disease from record (NHSN has separate columns per disease)
  const diseases = [];
  
  if (record.totalconfcovidadmissions && parseFloat(record.totalconfcovidadmissions) > 0) {
    diseases.push({
      disease: 'COVID-19',
      admissions: parseFloat(record.totalconfcovidadmissions),
      admissionsPer100k: record.covidadmissionsper100k ? parseFloat(record.covidadmissionsper100k) : null
    });
  }
  
  if (record.totalconfluadmissions && parseFloat(record.totalconfluadmissions) > 0) {
    diseases.push({
      disease: 'Influenza',
      admissions: parseFloat(record.totalconfluadmissions),
      admissionsPer100k: record.fluadmissionsper100k ? parseFloat(record.fluadmissionsper100k) : null
    });
  }
  
  if (record.totalconfrsvadmissions && parseFloat(record.totalconfrsvadmissions) > 0) {
    diseases.push({
      disease: 'RSV',
      admissions: parseFloat(record.totalconfrsvadmissions),
      admissionsPer100k: record.rsvadmissionsper100k ? parseFloat(record.rsvadmissionsper100k) : null
    });
  }
  
  if (diseases.length === 0) {
    return null;
  }
  
  return {
    state: record.jurisdiction,
    weekEndingDate: record.weekendingdate,
    diseases: diseases,
    totalBeds: record.totalbeds ? parseInt(record.totalbeds) : null,
    inpatientBeds: record.inpatientbeds ? parseInt(record.inpatientbeds) : null
  };
}

/**
 * Fetch and parse NHSN data for a specific state
 * @param {string} state - State abbreviation
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of parsed records
 */
async function fetchStateData(state, options = {}) {
  const records = await fetchNHSNData({ state, ...options });
  
  const parsed = records
    .map(parseNHSNRecord)
    .filter(record => record !== null);
  
  return parsed;
}

module.exports = {
  fetchNHSNData,
  parseNHSNRecord,
  fetchStateData,
  DISEASE_MAPPING
};
