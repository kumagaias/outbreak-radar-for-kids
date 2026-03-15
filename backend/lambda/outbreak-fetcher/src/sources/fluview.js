/**
 * Delphi Epidata FluView Data Fetcher
 * 
 * Fetches ILI (Influenza-like Illness) surveillance data from CDC FluView via Delphi Epidata API
 * Data source: CMU Delphi Epidata API
 * Geographic level: HHS regions and states
 * Age groups: 0-4, 5-24, 25-64, 65+
 * 
 * Requirements: 19.4, 19.8, 19.20
 */

const https = require('follow-redirects').https;

const FLUVIEW_ENDPOINT = 'https://api.delphi.cmu.edu/epidata/fluview';
const TIMEOUT_MS = 10000;

// HHS region mapping
const HHS_REGIONS = {
  '1': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT'],
  '2': ['NJ', 'NY'],
  '3': ['DE', 'DC', 'MD', 'PA', 'VA', 'WV'],
  '4': ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN'],
  '5': ['IL', 'IN', 'MI', 'MN', 'OH', 'WI'],
  '6': ['AR', 'LA', 'NM', 'OK', 'TX'],
  '7': ['IA', 'KS', 'MO', 'NE'],
  '8': ['CO', 'MT', 'ND', 'SD', 'UT', 'WY'],
  '9': ['AZ', 'CA', 'HI', 'NV'],
  '10': ['AK', 'ID', 'OR', 'WA']
};

/**
 * Fetch FluView ILI data
 * @param {Object} options - Fetch options
 * @param {string} options.regions - HHS regions (e.g., 'hhs1,hhs2' or 'ca,ny')
 * @param {string} options.epiweeks - Epiweeks range (e.g., '202401-202410')
 * @returns {Promise<Object>} API response with ILI data
 */
async function fetchFluViewData(options = {}) {
  const { regions = 'nat', epiweeks } = options;
  
  if (!epiweeks) {
    throw new Error('epiweeks parameter is required');
  }
  
  const params = new URLSearchParams({
    regions: regions,
    epiweeks: epiweeks
  });
  
  const url = `${FLUVIEW_ENDPOINT}?${params.toString()}`;
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`FluView API returned status ${res.statusCode}`));
          return;
        }
        
        try {
          const response = JSON.parse(data);
          
          if (response.result !== 1) {
            reject(new Error(`FluView API error: ${response.message || 'Unknown error'}`));
            return;
          }
          
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse FluView response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`FluView API request failed: ${error.message}`));
    });
    
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('FluView API request timeout'));
    });
  });
}

/**
 * Parse FluView record into standardized format
 * @param {Object} record - Raw FluView record
 * @returns {Object|null} Parsed record or null if invalid
 */
function parseFluViewRecord(record) {
  if (!record || !record.region || !record.epiweek) {
    return null;
  }
  
  // Extract ILI percentage (weighted_ili is the primary metric)
  const iliPercentage = record.weighted_ili !== undefined ? parseFloat(record.weighted_ili) : null;
  
  if (iliPercentage === null || isNaN(iliPercentage)) {
    return null;
  }
  
  // Parse age group data if available
  const ageGroups = {};
  if (record.age_0_4 !== undefined) ageGroups['0-4'] = parseFloat(record.age_0_4);
  if (record.age_5_24 !== undefined) ageGroups['5-24'] = parseFloat(record.age_5_24);
  if (record.age_25_64 !== undefined) ageGroups['25-64'] = parseFloat(record.age_25_64);
  if (record.age_65 !== undefined) ageGroups['65+'] = parseFloat(record.age_65);
  
  return {
    region: record.region,
    epiweek: record.epiweek,
    year: record.year,
    week: record.week,
    iliPercentage: iliPercentage,
    ageGroups: Object.keys(ageGroups).length > 0 ? ageGroups : null,
    totalPatients: record.total_patients ? parseInt(record.total_patients) : null,
    iliPatients: record.ili ? parseInt(record.ili) : null,
    lag: record.lag !== undefined ? parseInt(record.lag) : null
  };
}

/**
 * Get HHS region for a state
 * @param {string} state - State abbreviation (e.g., 'CA')
 * @returns {string|null} HHS region (e.g., 'hhs9') or null if not found
 */
function getHHSRegion(state) {
  const stateUpper = state.toUpperCase();
  
  for (const [region, states] of Object.entries(HHS_REGIONS)) {
    if (states.includes(stateUpper)) {
      return `hhs${region}`;
    }
  }
  
  return null;
}

/**
 * Fetch FluView data for a specific state
 * @param {string} state - State abbreviation
 * @param {string} epiweeks - Epiweeks range
 * @returns {Promise<Array>} Array of parsed records
 */
async function fetchStateData(state, epiweeks) {
  // Try state-level data first
  try {
    const response = await fetchFluViewData({ 
      regions: state.toLowerCase(), 
      epiweeks 
    });
    
    if (response.epidata && response.epidata.length > 0) {
      return response.epidata
        .map(parseFluViewRecord)
        .filter(record => record !== null);
    }
  } catch (error) {
    // State-level data not available, fall back to HHS region
  }
  
  // Fall back to HHS region
  const hhsRegion = getHHSRegion(state);
  if (!hhsRegion) {
    throw new Error(`Cannot determine HHS region for state: ${state}`);
  }
  
  const response = await fetchFluViewData({ 
    regions: hhsRegion, 
    epiweeks 
  });
  
  return response.epidata
    .map(parseFluViewRecord)
    .filter(record => record !== null);
}

/**
 * Convert date to epiweek format (YYYYWW)
 * @param {Date} date - Date object
 * @returns {number} Epiweek (e.g., 202401)
 */
function dateToEpiweek(date) {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  return year * 100 + week;
}

module.exports = {
  fetchFluViewData,
  parseFluViewRecord,
  fetchStateData,
  getHHSRegion,
  dateToEpiweek,
  HHS_REGIONS
};
