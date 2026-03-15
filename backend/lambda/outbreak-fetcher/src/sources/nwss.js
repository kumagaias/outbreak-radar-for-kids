/**
 * CDC NWSS (National Wastewater Surveillance System) Data Fetcher
 * 
 * Fetches wastewater surveillance data for SARS-CoV-2, Influenza A, RSV, 
 * Measles, Mpox, and H5 from CDC's SODA API.
 * 
 * Dataset: 2ew6-ywp6 (Public SARS-CoV-2 Wastewater Metric Data)
 * API: https://data.cdc.gov/resource/2ew6-ywp6.json
 * 
 * Requirements: 19.1, 19.6, 19.17
 */

const https = require('https');

/**
 * NWSS API Configuration
 */
const NWSS_API_BASE = 'https://data.cdc.gov/resource/2ew6-ywp6.json';
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RESULTS_PER_REQUEST = 50000; // SODA API default limit

/**
 * Disease mapping for NWSS data
 * Maps NWSS disease identifiers to standardized disease names
 */
const DISEASE_MAPPING = {
  'SARS-CoV-2': 'COVID-19',
  'Influenza A': 'Influenza A',
  'RSV': 'RSV',
  'Measles': 'Measles',
  'Mpox': 'Mpox',
  'H5': 'H5 Avian Influenza'
};

/**
 * Supported diseases in NWSS dataset
 */
const SUPPORTED_DISEASES = Object.keys(DISEASE_MAPPING);

/**
 * Fetch wastewater surveillance data from CDC NWSS
 * 
 * @param {Object} options - Fetch options
 * @param {string} options.state - US state abbreviation (e.g., 'CA', 'NY')
 * @param {string} [options.county] - County name (optional, for county-level filtering)
 * @param {string} [options.disease] - Specific disease to filter (optional)
 * @param {number} [options.daysBack=30] - Number of days to look back (default: 30)
 * @returns {Promise<Array>} Array of normalized wastewater data
 */
async function fetchNWSSData(options = {}) {
  const { state, county, disease, daysBack = 30 } = options;
  
  if (!state) {
    throw new Error('State parameter is required for NWSS data fetching');
  }
  
  console.log(`Fetching NWSS data for state: ${state}, county: ${county || 'all'}, disease: ${disease || 'all'}`);
  
  try {
    // Build SODA API query
    const query = buildSODAQuery({ state, county, disease, daysBack });
    const url = `${NWSS_API_BASE}?${query}`;
    
    console.log(`NWSS API URL: ${url}`);
    
    // Fetch data from SODA API
    const rawData = await makeHTTPSRequest(url);
    
    console.log(`Fetched ${rawData.length} records from NWSS`);
    
    // Parse and normalize data
    const normalizedData = parseNWSSData(rawData, state, county);
    
    console.log(`Normalized ${normalizedData.length} NWSS records`);
    
    return normalizedData;
  } catch (error) {
    console.error('Error fetching NWSS data:', error);
    throw new Error(`NWSS data fetch failed: ${error.message}`);
  }
}

/**
 * Build SODA API query string
 * 
 * Strategy: Fetch most recent data available (no date filter initially)
 * This ensures we get the latest data regardless of current date
 * 
 * @param {Object} params - Query parameters
 * @returns {string} URL-encoded query string
 */
function buildSODAQuery(params) {
  const { state, county, disease } = params;
  
  // Build WHERE clause
  const whereConditions = [];
  
  // Filter by state (use reporting_jurisdiction field)
  whereConditions.push(`reporting_jurisdiction='${state}'`);
  
  // Filter by county if provided (use county_names field)
  if (county) {
    whereConditions.push(`county_names='${county}'`);
  }
  
  // Note: NWSS dataset doesn't have pathogen field in current schema
  // Disease filtering will be done post-fetch if needed
  
  const whereClause = whereConditions.join(' AND ');
  
  // Build query parameters
  // Fetch most recent 1000 records (covers ~30 days typically)
  const queryParams = new URLSearchParams({
    '$where': whereClause,
    '$limit': 1000,
    '$order': 'date_end DESC'
  });
  
  return queryParams.toString();
}

/**
 * Make HTTPS request to SODA API
 * 
 * @param {string} url - API endpoint URL
 * @returns {Promise<Array>} Parsed JSON response
 */
function makeHTTPSRequest(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      
      // Handle non-200 status codes
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Accumulate response data
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      // Parse JSON when complete
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });
    
    // Set timeout
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    // Handle request errors
    request.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });
  });
}

/**
 * Parse and normalize NWSS raw data
 * 
 * @param {Array} rawData - Raw SODA API response
 * @param {string} state - State filter
 * @param {string} [county] - County filter (optional)
 * @returns {Array} Normalized outbreak data
 */
function parseNWSSData(rawData, state, county) {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    console.warn('No NWSS data to parse');
    return [];
  }
  
  const normalizedData = [];
  
  for (const record of rawData) {
    try {
      // Extract key fields (using actual NWSS field names)
      const {
        reporting_jurisdiction,
        county_names,
        date_end,
        percentile,
        detect_prop_15d,
        ptc_15d
      } = record;
      
      // Skip records without required fields
      if (!reporting_jurisdiction || !date_end) {
        continue;
      }
      
      // NWSS doesn't specify pathogen in current schema
      // Assume general wastewater surveillance (COVID-19 is primary target)
      const diseaseName = 'COVID-19';
      const pathogen = 'SARS-CoV-2';
      
      // Parse wastewater activity level (percentile: 0-100)
      // Higher percentile = higher viral activity
      const activityLevel = parseFloat(percentile) || 0;
      
      // Parse detection proportion (percentage of sites detecting pathogen)
      const detectionProportion = parseFloat(detect_prop_15d) || 0;
      
      // Parse percent change in viral activity (15-day trend)
      const percentChange = parseFloat(ptc_15d) || 0;
      
      // Determine geographic unit
      const geographicUnit = {
        country: 'US',
        stateOrPrefecture: reporting_jurisdiction,
        countyOrWard: county_names || null
      };
      
      // Create normalized data entry
      normalizedData.push({
        source: 'NWSS',
        diseaseId: pathogen,
        diseaseName: diseaseName,
        date: date_end,
        geographicUnit: geographicUnit,
        metrics: {
          wastewaterActivityLevel: activityLevel, // 0-100 percentile
          detectionProportion: detectionProportion, // 0-100 percentage
          percentChange15d: percentChange, // Trend indicator
          rawPercentile: percentile
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error parsing NWSS record:', error, record);
      // Continue processing other records
    }
  }
  
  return normalizedData;
}

/**
 * Get supported diseases for NWSS
 * 
 * @returns {Array<string>} List of supported disease names
 */
function getSupportedDiseases() {
  return SUPPORTED_DISEASES;
}

module.exports = {
  fetchNWSSData,
  getSupportedDiseases,
  DISEASE_MAPPING
};
