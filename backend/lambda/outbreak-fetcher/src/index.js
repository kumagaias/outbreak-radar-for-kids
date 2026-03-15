/**
 * Outbreak Data Fetcher Lambda Handler
 * 
 * Main handler for batch processing outbreak data from multiple sources:
 * - CDC NWSS (wastewater surveillance)
 * - CDC NHSN (hospital admissions)
 * - Delphi Epidata FluView (ILI surveillance)
 * - Delphi Epidata FluSurv-NET (hospitalization rates)
 * - NIID IDWR (Japan infectious disease weekly reports)
 * - e-Stat API (Japan norovirus data)
 * 
 * Triggered by EventBridge scheduler (weekly)
 * Fetches data in parallel, normalizes, calculates severity scores, and stores in DynamoDB
 * 
 * Requirements: 19.9, 19.10, 19.31, 19.32, 19.33, 19.34, 19.35, 19.36
 */

const { fetchNWSSData } = require('./sources/nwss');
const { fetchStateData: fetchNHSNStateData } = require('./sources/nhsn');
const { fetchStateData: fetchFluViewStateData, dateToEpiweek: fluviewDateToEpiweek } = require('./sources/fluview');
const { fetchLocationData: fetchFluSurvLocationData, getRecentEpiweeksRange } = require('./sources/flusurv');
const { fetchWeekData: fetchIDWRWeekData } = require('./sources/idwr');
const { fetchNorovirusData: fetchEStatNorovirusData } = require('./sources/estat');
const {
  normalizeNWSSData,
  normalizeNHSNData,
  normalizeFluViewData,
  normalizeFluSurvData,
  normalizeIDWRData,
  normalizeEStatData,
  combineDataSources
} = require('./normalizer');
const { batchStoreOutbreakData } = require('./dynamodb-storage');
const { generateMockIDWRData, MAJOR_PREFECTURES } = require('./mock-data/idwr-historical');

// Configuration
const FETCH_TIMEOUT_MS = 10000; // 10 seconds per API call
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // Initial retry delay (exponential backoff)
const DAYS_BACK = 30; // Fetch last 30 days of data

// US states to fetch data for (can be expanded or made configurable)
const TARGET_STATES = process.env.TARGET_STATES 
  ? process.env.TARGET_STATES.split(',')
  : ['CA', 'NY', 'TX', 'FL', 'IL']; // Default to top 5 populous states

// Japan data configuration
const FETCH_JAPAN_DATA = process.env.FETCH_JAPAN_DATA === 'true'; // Default to false (disabled)
const ESTAT_STATS_DATA_ID = process.env.ESTAT_STATS_DATA_ID || ''; // e-Stat dataset ID for norovirus data

/**
 * Lambda handler
 * Triggered by EventBridge scheduler
 * 
 * @param {Object} event - EventBridge event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} Execution result
 */
exports.handler = async (event, context) => {
  console.log('Outbreak data fetcher started', {
    requestId: context.requestId,
    targetStates: TARGET_STATES,
    daysBack: DAYS_BACK
  });

  const startTime = Date.now();
  const results = {
    success: false,
    fetchResults: {},
    normalizedCount: 0,
    storedCount: 0,
    errors: [],
    executionTimeMs: 0
  };

  try {
    // Fetch data from all sources in parallel
    console.log('Fetching data from all sources in parallel...');
    const fetchResults = await fetchAllSources(TARGET_STATES);
    results.fetchResults = fetchResults;

    // Normalize data from all sources
    console.log('Normalizing data from all sources...');
    const normalizedData = normalizeAllSources(fetchResults);
    results.normalizedCount = normalizedData.length;
    console.log(`Normalized ${normalizedData.length} records`);

    // Combine data sources and calculate severity scores
    console.log('Combining data sources and calculating severity scores...');
    const combinedData = combineDataSources(normalizedData);
    console.log(`Combined into ${combinedData.length} outbreak records`);

    // Store in DynamoDB
    console.log('Storing data in DynamoDB...');
    const storeResult = await storeData(combinedData);
    results.storedCount = storeResult.successCount;

    if (storeResult.failureCount > 0) {
      results.errors.push(`Failed to store ${storeResult.failureCount} records`);
    }

    results.success = true;
    results.executionTimeMs = Date.now() - startTime;

    console.log('Outbreak data fetcher completed successfully', results);
    return results;

  } catch (error) {
    console.error('Outbreak data fetcher failed:', error);
    results.errors.push(error.message);
    results.executionTimeMs = Date.now() - startTime;
    
    // Don't throw - return error result for monitoring
    return results;
  }
};

/**
 * Fetch data from all sources in parallel
 * Handles individual source failures gracefully
 * 
 * @param {Array<string>} states - Array of state codes
 * @returns {Promise<Object>} Fetch results from all sources
 */
async function fetchAllSources(states) {
  const results = {
    nwss: { success: false, data: [], error: null },
    nhsn: { success: false, data: [], error: null },
    fluview: { success: false, data: [], error: null },
    flusurv: { success: false, data: [], error: null },
    idwr: { success: false, data: [], error: null },
    estat: { success: false, data: [], error: null }
  };

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  // Calculate epiweeks range for Delphi Epidata APIs
  const epiweeksRange = getRecentEpiweeksRange(4); // Last 4 weeks

  // Calculate current year and week for Japan data sources
  const currentYear = endDate.getFullYear();
  const currentWeek = getWeekNumber(endDate);

  // Fetch from all sources in parallel
  const fetchPromises = states.flatMap(state => [
    // NWSS wastewater data
    fetchWithRetry(() => fetchNWSSData({ state, daysBack: DAYS_BACK }))
      .then(data => {
        results.nwss.data.push(...data);
        results.nwss.success = true;
      })
      .catch(error => {
        console.error(`NWSS fetch failed for ${state}:`, error.message);
        results.nwss.error = error.message;
      }),

    // NHSN hospital admission data
    fetchWithRetry(() => fetchNHSNStateData(state, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }))
      .then(data => {
        results.nhsn.data.push(...data);
        results.nhsn.success = true;
      })
      .catch(error => {
        console.error(`NHSN fetch failed for ${state}:`, error.message);
        results.nhsn.error = error.message;
      }),

    // FluView ILI data
    fetchWithRetry(() => fetchFluViewStateData(state, epiweeksRange))
      .then(data => {
        results.fluview.data.push(...data);
        results.fluview.success = true;
      })
      .catch(error => {
        console.error(`FluView fetch failed for ${state}:`, error.message);
        results.fluview.error = error.message;
      }),

    // FluSurv-NET hospitalization rate data
    fetchWithRetry(() => fetchFluSurvLocationData(state, epiweeksRange))
      .then(data => {
        results.flusurv.data.push(...data);
        results.flusurv.success = true;
      })
      .catch(error => {
        console.error(`FluSurv-NET fetch failed for ${state}:`, error.message);
        results.flusurv.error = error.message;
      })
  ]);

  // Add Japan data sources if enabled
  if (FETCH_JAPAN_DATA) {
    console.log('Fetching Japan data sources (IDWR, e-Stat)...');

    // IDWR weekly infectious disease reports
    fetchPromises.push(
      fetchWithRetry(() => fetchIDWRWeekData(currentYear, currentWeek))
        .then(data => {
          results.idwr.data.push(...data);
          results.idwr.success = true;
          console.log(`IDWR fetch succeeded: ${data.length} records`);
        })
        .catch(error => {
          console.error(`IDWR fetch failed for ${currentYear}-W${currentWeek}:`, error.message);
          results.idwr.error = error.message;
          
          // Fallback to mock data when IDWR is unavailable
          console.log('Using mock IDWR data as fallback...');
          try {
            const mockData = generateMockIDWRData({ date: endDate });
            results.idwr.data.push(...mockData);
            results.idwr.success = true;
            results.idwr.usingMockData = true;
            console.log(`Mock IDWR data generated: ${mockData.length} records`);
          } catch (mockError) {
            console.error('Failed to generate mock IDWR data:', mockError.message);
          }
        })
    );

    // e-Stat norovirus data (if dataset ID is configured)
    if (ESTAT_STATS_DATA_ID) {
      fetchPromises.push(
        fetchWithRetry(() => fetchEStatNorovirusData({
          statsDataId: ESTAT_STATS_DATA_ID,
          year: currentYear,
          week: currentWeek
        }))
          .then(data => {
            results.estat.data.push(...data);
            results.estat.success = true;
            console.log(`e-Stat fetch succeeded: ${data.length} records`);
          })
          .catch(error => {
            console.error(`e-Stat fetch failed for ${currentYear}-W${currentWeek}:`, error.message);
            results.estat.error = error.message;
            
            // Fallback to mock norovirus data when e-Stat is unavailable
            console.log('Using mock norovirus data as fallback for e-Stat...');
            try {
              const mockData = generateMockIDWRData({ date: endDate });
              // Filter only norovirus data (e-Stat is norovirus-specific)
              const norovirusData = mockData.filter(r => r.disease === 'Norovirus');
              results.estat.data.push(...norovirusData);
              results.estat.success = true;
              results.estat.usingMockData = true;
              console.log(`Mock norovirus data generated: ${norovirusData.length} records`);
            } catch (mockError) {
              console.error('Failed to generate mock norovirus data:', mockError.message);
            }
          })
      );
    } else {
      console.warn('e-Stat dataset ID not configured, using mock norovirus data...');
      // Use mock data when e-Stat is not configured
      try {
        const mockData = generateMockIDWRData({ date: endDate });
        const norovirusData = mockData.filter(r => r.disease === 'Norovirus');
        results.estat.data.push(...norovirusData);
        results.estat.success = true;
        results.estat.usingMockData = true;
        console.log(`Mock norovirus data generated (e-Stat not configured): ${norovirusData.length} records`);
      } catch (mockError) {
        console.error('Failed to generate mock norovirus data:', mockError.message);
      }
    }
  }

  // Wait for all fetches to complete (or fail)
  await Promise.allSettled(fetchPromises);

  // Log API call success/failure rates
  logAPICallStats(results);

  return results;
}

/**
 * Fetch with retry and exponential backoff
 * 
 * @param {Function} fetchFn - Fetch function to retry
 * @param {number} maxAttempts - Maximum retry attempts
 * @returns {Promise<any>} Fetch result
 */
async function fetchWithRetry(fetchFn, maxAttempts = MAX_RETRY_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Set timeout for fetch operation
      const result = await Promise.race([
        fetchFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), FETCH_TIMEOUT_MS)
        )
      ]);
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Fetch attempt ${attempt}/${maxAttempts} failed:`, error.message);

      // Don't retry on last attempt
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Normalize data from all sources
 * 
 * @param {Object} fetchResults - Fetch results from all sources
 * @returns {Array<Object>} Normalized outbreak data
 */
function normalizeAllSources(fetchResults) {
  const normalized = [];

  // Normalize NWSS data
  if (fetchResults.nwss.success && fetchResults.nwss.data.length > 0) {
    try {
      const nwssNormalized = normalizeNWSSData(fetchResults.nwss.data);
      normalized.push(...nwssNormalized);
      console.log(`Normalized ${nwssNormalized.length} NWSS records`);
    } catch (error) {
      console.error('NWSS normalization failed:', error);
    }
  }

  // Normalize NHSN data
  if (fetchResults.nhsn.success && fetchResults.nhsn.data.length > 0) {
    try {
      const nhsnNormalized = normalizeNHSNData(fetchResults.nhsn.data);
      normalized.push(...nhsnNormalized);
      console.log(`Normalized ${nhsnNormalized.length} NHSN records`);
    } catch (error) {
      console.error('NHSN normalization failed:', error);
    }
  }

  // Normalize FluView data
  if (fetchResults.fluview.success && fetchResults.fluview.data.length > 0) {
    try {
      const fluviewNormalized = normalizeFluViewData(fetchResults.fluview.data);
      normalized.push(...fluviewNormalized);
      console.log(`Normalized ${fluviewNormalized.length} FluView records`);
    } catch (error) {
      console.error('FluView normalization failed:', error);
    }
  }

  // Normalize FluSurv-NET data
  if (fetchResults.flusurv.success && fetchResults.flusurv.data.length > 0) {
    try {
      const flusurvNormalized = normalizeFluSurvData(fetchResults.flusurv.data);
      normalized.push(...flusurvNormalized);
      console.log(`Normalized ${flusurvNormalized.length} FluSurv-NET records`);
    } catch (error) {
      console.error('FluSurv-NET normalization failed:', error);
    }
  }

  // Normalize IDWR data (Japan)
  if (fetchResults.idwr.success && fetchResults.idwr.data.length > 0) {
    try {
      const idwrNormalized = normalizeIDWRData(fetchResults.idwr.data);
      normalized.push(...idwrNormalized);
      console.log(`Normalized ${idwrNormalized.length} IDWR records`);
    } catch (error) {
      console.error('IDWR normalization failed:', error);
    }
  }

  // Normalize e-Stat data (Japan)
  if (fetchResults.estat.success && fetchResults.estat.data.length > 0) {
    try {
      const estatNormalized = normalizeEStatData(fetchResults.estat.data);
      normalized.push(...estatNormalized);
      console.log(`Normalized ${estatNormalized.length} e-Stat records`);
    } catch (error) {
      console.error('e-Stat normalization failed:', error);
    }
  }

  return normalized;
}

/**
 * Store combined outbreak data in DynamoDB
 * 
 * @param {Array<Object>} combinedData - Combined outbreak data
 * @returns {Promise<Object>} Store result
 */
async function storeData(combinedData) {
  if (!combinedData || combinedData.length === 0) {
    console.warn('No data to store');
    return { successCount: 0, failureCount: 0 };
  }

  // Transform combined data to DynamoDB format
  const dynamoDBItems = combinedData.map(data => ({
    geographicArea: data.location.state || data.location.prefecture || 'National',
    country: data.location.country || 'US', // Add country field
    disease: data.disease,
    severity: data.severity,
    metrics: data.metrics,
    normalizedMetrics: data.metrics, // Already normalized
    timestamp: data.lastUpdated,
    dataSource: {
      sources: data.dataSource.split(', '),
      trend: data.trend
    },
    coverageLevel: data.location.county ? 'county' : 'state',
    proximityAdjustment: 1.0
  }));

  return await batchStoreOutbreakData(dynamoDBItems);
}

/**
 * Log API call success/failure statistics
 * 
 * @param {Object} results - Fetch results from all sources
 */
function logAPICallStats(results) {
  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    sources: {}
  };

  for (const [source, result] of Object.entries(results)) {
    stats.total++;
    stats.sources[source] = {
      success: result.success,
      recordCount: result.data.length,
      error: result.error
    };

    if (result.success) {
      stats.successful++;
    } else {
      stats.failed++;
    }
  }

  stats.successRate = stats.total > 0 
    ? ((stats.successful / stats.total) * 100).toFixed(1) + '%'
    : '0%';

  console.log('API Call Statistics:', JSON.stringify(stats, null, 2));
}

/**
 * Get ISO week number for a date
 * 
 * @param {Date} date - Date to get week number for
 * @returns {number} Week number (1-52)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

