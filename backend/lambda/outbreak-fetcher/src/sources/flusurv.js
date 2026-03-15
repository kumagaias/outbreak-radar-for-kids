/**
 * Delphi Epidata FluSurv-NET Data Fetcher
 * 
 * Fetches age-stratified hospitalization rate data for laboratory-confirmed influenza
 * from CDC FluSurv-NET via Delphi Epidata API
 * 
 * Data source: CMU Delphi Epidata API
 * Geographic level: FluSurv-NET surveillance network sites
 * Age groups: 0-1, 1-4, 5-11, 12-17, 18-49, 50-64, 65+ years
 * 
 * Requirements: 19.5, 19.8, 19.21, 19.22, 19.23, 19.24
 */

const https = require('follow-redirects').https;

const FLUSURV_ENDPOINT = 'https://api.delphi.cmu.edu/epidata/flusurv';
const TIMEOUT_MS = 10000;

/**
 * FluSurv-NET age groups
 * Prioritizes children under 18 years with granular age stratification
 */
const AGE_GROUPS = {
  '0-1': '0-1 yr',
  '1-4': '1-4 yr',
  '5-11': '5-11 yr',
  '12-17': '12-17 yr',
  '18-49': '18-49 yr',
  '50-64': '50-64 yr',
  '65+': '65+ yr'
};

/**
 * Child age groups (under 18 years) - prioritized for this app
 */
const CHILD_AGE_GROUPS = ['0-1', '1-4', '5-11', '12-17'];

/**
 * Disease mapping for FluSurv-NET
 */
const DISEASE_MAPPING = {
  'flu_a': 'Influenza A',
  'flu_b': 'Influenza B'
};

/**
 * Supported diseases in FluSurv-NET
 */
const SUPPORTED_DISEASES = Object.keys(DISEASE_MAPPING);

/**
 * Fetch FluSurv-NET hospitalization rate data
 * 
 * @param {Object} options - Fetch options
 * @param {string} options.locations - FluSurv-NET locations (e.g., 'network_all' or 'ca,ny')
 * @param {string} options.epiweeks - Epiweeks range (e.g., '202401-202410')
 * @returns {Promise<Object>} API response with hospitalization rate data
 */
async function fetchFluSurvData(options = {}) {
  const { locations = 'network_all', epiweeks } = options;
  
  if (!epiweeks) {
    throw new Error('epiweeks parameter is required');
  }
  
  const params = new URLSearchParams({
    locations: locations,
    epiweeks: epiweeks
  });
  
  const url = `${FLUSURV_ENDPOINT}?${params.toString()}`;
  
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`FluSurv-NET API returned status ${res.statusCode}`));
          return;
        }
        
        try {
          const response = JSON.parse(data);
          
          if (response.result !== 1) {
            reject(new Error(`FluSurv-NET API error: ${response.message || 'Unknown error'}`));
            return;
          }
          
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse FluSurv-NET response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`FluSurv-NET API request failed: ${error.message}`));
    });
    
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('FluSurv-NET API request timeout'));
    });
  });
}

/**
 * Parse FluSurv-NET record into standardized format
 * 
 * @param {Object} record - Raw FluSurv-NET record
 * @returns {Object|null} Parsed record or null if invalid
 */
function parseFluSurvRecord(record) {
  if (!record || !record.location || !record.epiweek) {
    return null;
  }
  
  // Extract age-specific hospitalization rates
  const ageGroupRates = {};
  
  // Parse rates for each age group (rate per 100,000 population)
  for (const [ageKey, ageLabel] of Object.entries(AGE_GROUPS)) {
    const rateField = `rate_age_${ageKey.replace('-', '_')}`;
    if (record[rateField] !== undefined) {
      const rate = parseFloat(record[rateField]);
      if (!isNaN(rate) && rate >= 0) {
        ageGroupRates[ageKey] = rate;
      }
    }
  }
  
  // Skip records with no valid age group data
  if (Object.keys(ageGroupRates).length === 0) {
    return null;
  }
  
  // Extract overall rate
  const overallRate = record.rate_overall !== undefined ? parseFloat(record.rate_overall) : null;
  
  return {
    location: record.location,
    epiweek: record.epiweek,
    year: record.year,
    week: record.week,
    ageGroupRates: ageGroupRates,
    overallRate: overallRate,
    lag: record.lag !== undefined ? parseInt(record.lag) : null
  };
}

/**
 * Get hospitalization rate for a specific app age range
 * Maps app age ranges to FluSurv-NET age groups (Requirement 19.24)
 * 
 * @param {Object} ageGroupRates - Age group rates from FluSurv-NET
 * @param {string} appAgeRange - App age range ('0-1', '2-3', '4-6', '7+')
 * @returns {number|null} Hospitalization rate per 100k or null if not available
 */
function getAgeSpecificRate(ageGroupRates, appAgeRange) {
  // Map app age ranges to FluSurv-NET age groups
  const ageMapping = {
    '0-1': '0-1',      // App 0-1 years → FluSurv-NET 0-1 years
    '2-3': '1-4',      // App 2-3 years → FluSurv-NET 1-4 years
    '4-6': '5-11',     // App 4-6 years → FluSurv-NET 5-11 years (conservative)
    '7+': '5-11'       // App 7+ years → FluSurv-NET 5-11 years (fallback to 12-17 if available)
  };
  
  const flusurvAgeGroup = ageMapping[appAgeRange];
  
  if (!flusurvAgeGroup) {
    return null;
  }
  
  // For 7+ age range, prefer 12-17 if available, otherwise use 5-11
  if (appAgeRange === '7+') {
    if (ageGroupRates['12-17'] !== undefined) {
      return ageGroupRates['12-17'];
    }
  }
  
  return ageGroupRates[flusurvAgeGroup] || null;
}

/**
 * Filter records to prioritize child age groups (under 18 years)
 * Requirement 19.22: Prioritize FluSurv-NET data for children under 18 years
 * 
 * @param {Array} records - Array of parsed FluSurv-NET records
 * @returns {Array} Filtered records with child age group data
 */
function filterChildAgeGroups(records) {
  return records.filter(record => {
    // Check if record has any child age group data
    const hasChildData = CHILD_AGE_GROUPS.some(
      ageGroup => record.ageGroupRates[ageGroup] !== undefined
    );
    return hasChildData;
  });
}

/**
 * Fetch FluSurv-NET data for a specific location
 * 
 * @param {string} location - FluSurv-NET location (e.g., 'network_all', 'ca', 'ny')
 * @param {string} epiweeks - Epiweeks range
 * @returns {Promise<Array>} Array of parsed records
 */
async function fetchLocationData(location, epiweeks) {
  const response = await fetchFluSurvData({ 
    locations: location.toLowerCase(), 
    epiweeks 
  });
  
  if (!response.epidata || response.epidata.length === 0) {
    return [];
  }
  
  return response.epidata
    .map(parseFluSurvRecord)
    .filter(record => record !== null);
}

/**
 * Convert date to epiweek format (YYYYWW)
 * 
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

/**
 * Get epiweeks range for the last N weeks
 * 
 * @param {number} weeksBack - Number of weeks to look back (default: 4)
 * @returns {string} Epiweeks range (e.g., '202401-202404')
 */
function getRecentEpiweeksRange(weeksBack = 4) {
  // Use current date to get latest available data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeksBack * 7));
  
  const startEpiweek = dateToEpiweek(startDate);
  const endEpiweek = dateToEpiweek(endDate);
  
  return `${startEpiweek}-${endEpiweek}`;
}

module.exports = {
  fetchFluSurvData,
  parseFluSurvRecord,
  fetchLocationData,
  getAgeSpecificRate,
  filterChildAgeGroups,
  dateToEpiweek,
  getRecentEpiweeksRange,
  AGE_GROUPS,
  CHILD_AGE_GROUPS,
  DISEASE_MAPPING,
  SUPPORTED_DISEASES
};
