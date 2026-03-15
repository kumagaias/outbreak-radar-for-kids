/**
 * Data Normalizer and Severity Calculator
 * 
 * Normalizes data from multiple sources (NWSS, NHSN, FluView, FluSurv-NET) into
 * unified OutbreakData format and calculates severity scores using weighted formula.
 * 
 * Requirements: 19.9, 19.10, 19.11, 19.12, 19.13, 19.14, 19.15, 19.16
 */

/**
 * OutbreakData Schema
 * Unified format for all data sources
 */
const OUTBREAK_DATA_SCHEMA = {
  disease: 'string',           // Disease name (e.g., "COVID-19", "Influenza A")
  location: {
    state: 'string',          // State code (e.g., "CA")
    county: 'string'          // County name (optional)
  },
  severity: 'number',         // Severity score (0-100)
  trend: 'string',            // Trend ("increasing", "stable", "decreasing")
  dataSource: 'string',       // Data source (e.g., "CDC NWSS")
  lastUpdated: 'string',      // Last updated date (ISO 8601 format)
  metrics: 'object'           // Data source-specific metrics
};

/**
 * Severity calculation weights
 * Requirements: 19.14
 */
const SEVERITY_WEIGHTS = {
  // Default weights when all sources available
  DEFAULT: {
    wastewater: 0.40,        // NWSS wastewater viral activity
    ili: 0.30,               // FluView ILI percentage
    hospitalAdmissions: 0.20, // NHSN hospital admissions
    hospitalizationRate: 0.10 // FluSurv-NET hospitalization rate
  },
  // Weights when WastewaterSCAN unavailable (Requirement 19.14)
  NO_WASTEWATERSCAN: {
    wastewater: 0.40,        // NWSS only
    ili: 0.35,               // Increased from 30%
    hospitalAdmissions: 0.15, // Decreased from 20%
    hospitalizationRate: 0.10 // Unchanged
  },
  // Weights when wastewater shows upward trend (leading indicator)
  WASTEWATER_UPTREND: {
    wastewater: 0.50,        // Increased from 40%
    ili: 0.25,               // Decreased from 30%
    hospitalAdmissions: 0.15, // Decreased from 20%
    hospitalizationRate: 0.10 // Unchanged
  }
};

/**
 * CDC baseline values for cold start scenarios
 * Used when trailing 12-month data unavailable
 * Requirement: 19.14
 */
const CDC_BASELINE_VALUES = {
  wastewaterActivityLevel: 5,      // Moderate activity (0-10 scale)
  iliPercentage: 2.5,              // 2.5% ILI baseline
  hospitalAdmissions: 1000,        // 1000 admissions per week
  hospitalizationRate: 5           // 5 per 100k population
};

/**
 * Trend thresholds for temporal analysis
 */
const TREND_THRESHOLDS = {
  INCREASING: 0.10,  // 10% increase over 4 weeks
  DECREASING: -0.10  // 10% decrease over 4 weeks
};

/**
 * Normalize NWSS wastewater data to unified format
 * 
 * @param {Array} nwssData - Raw NWSS data from fetcher
 * @param {Object} historicalData - Trailing 12-month data for normalization
 * @returns {Array} Normalized outbreak data
 */
function normalizeNWSSData(nwssData, historicalData = {}) {
  if (!Array.isArray(nwssData) || nwssData.length === 0) {
    return [];
  }
  
  const normalized = [];
  
  for (const record of nwssData) {
    try {
      const {
        diseaseName,
        geographicUnit,
        metrics,
        date,
        timestamp
      } = record;
      
      // Normalize wastewater activity level (0-100 scale)
      const normalizedActivity = normalizeMetric(
        metrics.wastewaterActivityLevel,
        historicalData.wastewater || {},
        CDC_BASELINE_VALUES.wastewaterActivityLevel
      );
      
      // Calculate trend from percent change
      const trend = calculateTrendFromPercentChange(metrics.percentChange15d);
      
      normalized.push({
        disease: diseaseName,
        location: {
          state: geographicUnit.stateOrPrefecture,
          county: geographicUnit.countyOrWard || null
        },
        severity: normalizedActivity, // Will be combined with other sources
        trend: trend,
        dataSource: 'CDC NWSS',
        lastUpdated: date,
        metrics: {
          wastewaterActivityLevel: normalizedActivity,
          detectionProportion: metrics.detectionProportion,
          percentChange15d: metrics.percentChange15d,
          rawPercentile: metrics.rawPercentile
        }
      });
    } catch (error) {
      console.error('Error normalizing NWSS record:', error, record);
    }
  }
  
  return normalized;
}

/**
 * Normalize NHSN hospital admission data to unified format
 * 
 * @param {Array} nhsnData - Raw NHSN data from fetcher
 * @param {Object} historicalData - Trailing 12-month data for normalization
 * @returns {Array} Normalized outbreak data
 */
function normalizeNHSNData(nhsnData, historicalData = {}) {
  if (!Array.isArray(nhsnData) || nhsnData.length === 0) {
    return [];
  }
  
  const normalized = [];
  
  for (const record of nhsnData) {
    try {
      const { state, weekEndingDate, diseases } = record;
      
      for (const diseaseData of diseases) {
        const { disease, admissions, admissionsPer100k } = diseaseData;
        
        // Normalize hospital admissions (0-100 scale)
        const normalizedAdmissions = normalizeMetric(
          admissions,
          historicalData.hospitalAdmissions || {},
          CDC_BASELINE_VALUES.hospitalAdmissions
        );
        
        normalized.push({
          disease: disease,
          location: {
            state: state,
            county: null  // NHSN only provides state-level data
          },
          severity: normalizedAdmissions, // Will be combined with other sources
          trend: 'stable', // NHSN doesn't provide trend data directly
          dataSource: 'CDC NHSN',
          lastUpdated: weekEndingDate,
          metrics: {
            hospitalAdmissions: normalizedAdmissions,
            rawAdmissions: admissions,
            admissionsPer100k: admissionsPer100k
          }
        });
      }
    } catch (error) {
      console.error('Error normalizing NHSN record:', error, record);
    }
  }
  
  return normalized;
}

/**
 * Normalize FluView ILI data to unified format
 * 
 * @param {Array} fluviewData - Raw FluView data from fetcher
 * @param {Object} historicalData - Trailing 12-month data for normalization
 * @returns {Array} Normalized outbreak data
 */
function normalizeFluViewData(fluviewData, historicalData = {}) {
  if (!Array.isArray(fluviewData) || fluviewData.length === 0) {
    return [];
  }
  
  const normalized = [];
  
  for (const record of fluviewData) {
    try {
      const { region, iliPercentage, epiweek, year, week } = record;
      
      // Normalize ILI percentage (0-100 scale)
      const normalizedILI = normalizeMetric(
        iliPercentage,
        historicalData.ili || {},
        CDC_BASELINE_VALUES.iliPercentage
      );
      
      // Construct date from epiweek
      const date = epiweekToDate(year, week);
      
      normalized.push({
        disease: 'Influenza-like Illness',
        location: {
          state: region.startsWith('hhs') ? null : region.toUpperCase(),
          county: null
        },
        severity: normalizedILI, // Will be combined with other sources
        trend: 'stable', // FluView doesn't provide trend data directly
        dataSource: 'Delphi Epidata FluView',
        lastUpdated: date,
        metrics: {
          iliPercentage: normalizedILI,
          rawILIPercentage: iliPercentage,
          region: region,
          epiweek: epiweek
        }
      });
    } catch (error) {
      console.error('Error normalizing FluView record:', error, record);
    }
  }
  
  return normalized;
}

/**
 * Normalize FluSurv-NET hospitalization rate data to unified format
 * 
 * @param {Array} flusurvData - Raw FluSurv-NET data from fetcher
 * @param {Object} historicalData - Trailing 12-month data for normalization
 * @returns {Array} Normalized outbreak data
 */
function normalizeFluSurvData(flusurvData, historicalData = {}) {
  if (!Array.isArray(flusurvData) || flusurvData.length === 0) {
    return [];
  }
  
  const normalized = [];
  
  for (const record of flusurvData) {
    try {
      const { location, ageGroupRates, overallRate, epiweek, year, week } = record;
      
      // Normalize hospitalization rate (0-100 scale)
      const normalizedRate = normalizeMetric(
        overallRate,
        historicalData.hospitalizationRate || {},
        CDC_BASELINE_VALUES.hospitalizationRate
      );
      
      // Construct date from epiweek
      const date = epiweekToDate(year, week);
      
      normalized.push({
        disease: 'Influenza',
        location: {
          state: location === 'network_all' ? null : location.toUpperCase(),
          county: null
        },
        severity: normalizedRate, // Will be combined with other sources
        trend: 'stable', // FluSurv-NET doesn't provide trend data directly
        dataSource: 'Delphi Epidata FluSurv-NET',
        lastUpdated: date,
        metrics: {
          hospitalizationRate: normalizedRate,
          rawRate: overallRate,
          ageGroupRates: ageGroupRates,
          location: location
        }
      });
    } catch (error) {
      console.error('Error normalizing FluSurv-NET record:', error, record);
    }
  }
  
  return normalized;
}

/**
 * Normalize metric to 0-100 scale using Min-Max Scaling
 * 
 * Formula: Normalized = (Current - Min) / (Max - Min) × 100
 * 
 * @param {number} value - Current metric value
 * @param {Object} historical - Historical data with min/max values
 * @param {number} baseline - CDC baseline value for cold start
 * @returns {number} Normalized value (0-100)
 */
function normalizeMetric(value, historical, baseline) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  
  // Use historical min/max if available, otherwise use baseline
  const min = historical.min !== undefined ? historical.min : baseline * 0.5;
  const max = historical.max !== undefined ? historical.max : baseline * 2.0;
  
  // Prevent division by zero
  if (max === min) {
    return 50; // Return middle value if no variation
  }
  
  // Apply Min-Max Scaling
  const normalized = ((value - min) / (max - min)) * 100;
  
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Calculate combined severity score from multiple data sources
 * 
 * @param {Object} metrics - Metrics from all data sources
 * @param {boolean} wastewaterUptrend - Whether wastewater shows upward trend
 * @param {boolean} wastewaterScanAvailable - Whether WastewaterSCAN data is available
 * @returns {number} Combined severity score (0-100)
 */
function calculateSeverityScore(metrics, wastewaterUptrend = false, wastewaterScanAvailable = true) {
  // Select appropriate weights based on conditions
  let weights;
  if (wastewaterUptrend) {
    weights = SEVERITY_WEIGHTS.WASTEWATER_UPTREND;
  } else if (!wastewaterScanAvailable) {
    weights = SEVERITY_WEIGHTS.NO_WASTEWATERSCAN;
  } else {
    weights = SEVERITY_WEIGHTS.DEFAULT;
  }
  
  // Calculate weighted severity score
  let severityScore = 0;
  let totalWeight = 0;
  
  if (metrics.wastewater !== undefined && metrics.wastewater !== null) {
    severityScore += metrics.wastewater * weights.wastewater;
    totalWeight += weights.wastewater;
  }
  
  if (metrics.ili !== undefined && metrics.ili !== null) {
    severityScore += metrics.ili * weights.ili;
    totalWeight += weights.ili;
  }
  
  if (metrics.hospitalAdmissions !== undefined && metrics.hospitalAdmissions !== null) {
    severityScore += metrics.hospitalAdmissions * weights.hospitalAdmissions;
    totalWeight += weights.hospitalAdmissions;
  }
  
  if (metrics.hospitalizationRate !== undefined && metrics.hospitalizationRate !== null) {
    severityScore += metrics.hospitalizationRate * weights.hospitalizationRate;
    totalWeight += weights.hospitalizationRate;
  }
  
  // Normalize by total weight (handle missing data sources)
  if (totalWeight === 0) {
    return 0;
  }
  
  return severityScore / totalWeight;
}

/**
 * Calculate temporal trend from time series data
 * 
 * @param {Array} timeSeries - Array of data points with {date, value}
 * @param {number} weeksBack - Number of weeks to analyze (default: 4)
 * @returns {string} Trend ("increasing", "stable", "decreasing")
 */
function calculateTrend(timeSeries, weeksBack = 4) {
  if (!Array.isArray(timeSeries) || timeSeries.length < 2) {
    return 'stable';
  }
  
  // Sort by date (most recent first)
  const sorted = timeSeries
    .filter(point => point.value !== null && point.value !== undefined)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (sorted.length < 2) {
    return 'stable';
  }
  
  // Get most recent value and value from weeksBack ago
  const recentValue = sorted[0].value;
  const pastValue = sorted[Math.min(weeksBack, sorted.length - 1)].value;
  
  // Calculate percent change
  const percentChange = (recentValue - pastValue) / pastValue;
  
  return calculateTrendFromPercentChange(percentChange * 100);
}

/**
 * Calculate trend from percent change value
 * 
 * @param {number} percentChange - Percent change value
 * @returns {string} Trend ("increasing", "stable", "decreasing")
 */
function calculateTrendFromPercentChange(percentChange) {
  if (percentChange === null || percentChange === undefined || isNaN(percentChange)) {
    return 'stable';
  }
  
  if (percentChange >= TREND_THRESHOLDS.INCREASING * 100) {
    return 'increasing';
  } else if (percentChange <= TREND_THRESHOLDS.DECREASING * 100) {
    return 'decreasing';
  } else {
    return 'stable';
  }
}

/**
 * Convert epiweek to ISO date string
 * 
 * @param {number} year - Year
 * @param {number} week - Week number
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function epiweekToDate(year, week) {
  // Calculate the date for the given epiweek
  // Week 1 starts on the first day of the year
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const daysToAdd = (week - 1) * 7;
  const date = new Date(startOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * Combine normalized data from multiple sources for the same disease and location
 * 
 * @param {Array} normalizedData - Array of normalized outbreak data from all sources
 * @returns {Array} Combined outbreak data with severity scores
 */
function combineDataSources(normalizedData) {
  if (!Array.isArray(normalizedData) || normalizedData.length === 0) {
    return [];
  }
  
  // Group by disease and location
  const grouped = {};
  
  for (const data of normalizedData) {
    const key = `${data.disease}|${data.location.state || 'NATIONAL'}|${data.location.county || 'STATE'}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        disease: data.disease,
        location: data.location,
        sources: [],
        metrics: {},
        lastUpdated: data.lastUpdated
      };
    }
    
    grouped[key].sources.push(data.dataSource);
    
    // Collect metrics from each source
    if (data.dataSource === 'CDC NWSS') {
      grouped[key].metrics.wastewater = data.metrics.wastewaterActivityLevel;
      grouped[key].wastewaterTrend = data.trend;
    } else if (data.dataSource === 'CDC NHSN') {
      grouped[key].metrics.hospitalAdmissions = data.metrics.hospitalAdmissions;
    } else if (data.dataSource === 'Delphi Epidata FluView') {
      grouped[key].metrics.ili = data.metrics.iliPercentage;
    } else if (data.dataSource === 'Delphi Epidata FluSurv-NET') {
      grouped[key].metrics.hospitalizationRate = data.metrics.hospitalizationRate;
    }
    
    // Update lastUpdated to most recent
    if (new Date(data.lastUpdated) > new Date(grouped[key].lastUpdated)) {
      grouped[key].lastUpdated = data.lastUpdated;
    }
  }
  
  // Calculate combined severity scores
  const combined = [];
  
  for (const key in grouped) {
    const group = grouped[key];
    
    // Check if wastewater shows upward trend
    const wastewaterUptrend = group.wastewaterTrend === 'increasing';
    
    // Calculate combined severity score
    const severityScore = calculateSeverityScore(
      group.metrics,
      wastewaterUptrend,
      true // Assume WastewaterSCAN available for now
    );
    
    // Determine overall trend (prioritize wastewater as leading indicator)
    const trend = group.wastewaterTrend || 'stable';
    
    combined.push({
      disease: group.disease,
      location: group.location,
      severity: Math.round(severityScore * 10) / 10, // Round to 1 decimal
      trend: trend,
      dataSource: group.sources.join(', '),
      lastUpdated: group.lastUpdated,
      metrics: group.metrics
    });
  }
  
  return combined;
}

/**
 * Normalize IDWR data to unified format
 * 
 * @param {Array} idwrData - Raw IDWR data from fetcher (already normalized by idwr.js)
 * @param {Object} historicalData - Trailing 12-month data for normalization
 * @returns {Array} Normalized outbreak data
 */
function normalizeIDWRData(idwrData, historicalData = {}) {
  if (!Array.isArray(idwrData) || idwrData.length === 0) {
    return [];
  }
  
  const normalized = [];
  
  for (const record of idwrData) {
    try {
      const {
        disease,
        diseaseJa,
        prefecture,
        caseCount,
        reportWeek,
        reportYear
      } = record;
      
      // Skip if missing required fields
      if (!disease || !prefecture) {
        continue;
      }
      
      // Normalize case count (0-100 scale)
      // For Japan data, use simple scaling based on typical outbreak sizes
      // TODO: Implement proper Min-Max scaling with historical data
      const normalizedCaseCount = Math.min(100, (caseCount / 1000) * 100);
      
      // Calculate severity score (simplified for MVP)
      // Japan data doesn't have multiple metrics like US data
      const severity = normalizedCaseCount;
      
      // Calculate trend (requires historical data - placeholder for MVP)
      const trend = 'stable';
      
      normalized.push({
        disease: disease,
        diseaseLocal: diseaseJa,
        location: {
          country: 'Japan',
          prefecture: prefecture,
          state: prefecture // Alias for consistency with US data
        },
        severity: severity,
        trend: trend,
        dataSource: 'NIID IDWR',
        lastUpdated: reportYear && reportWeek 
          ? `${reportYear}-W${String(reportWeek).padStart(2, '0')}`
          : new Date().toISOString(),
        metrics: {
          caseCount: caseCount,
          normalizedCaseCount: normalizedCaseCount,
          reportWeek: reportWeek,
          reportYear: reportYear
        }
      });
    } catch (error) {
      console.warn('Error normalizing IDWR record:', error, record);
      // Continue with next record
    }
  }
  
  return normalized;
}

/**
 * Normalize e-Stat data to unified format
 * 
 * @param {Array} estatData - Raw e-Stat data from fetcher (already normalized by estat.js)
 * @param {Object} historicalData - Trailing 12-month data for normalization
 * @returns {Array} Normalized outbreak data
 */
function normalizeEStatData(estatData, historicalData = {}) {
  if (!Array.isArray(estatData) || estatData.length === 0) {
    return [];
  }
  
  const normalized = [];
  
  for (const record of estatData) {
    try {
      const {
        disease,
        diseaseJa,
        prefecture,
        prefectureJa,
        caseCount,
        per100kPopulation,
        weekNumber,
        year
      } = record;
      
      // Skip if missing required fields
      if (!disease || !prefecture) {
        continue;
      }
      
      // Normalize case count (0-100 scale)
      // For norovirus, typical outbreak sizes are larger than other diseases
      const normalizedCaseCount = Math.min(100, (caseCount / 2000) * 100);
      
      // Calculate severity score (simplified for MVP)
      const severity = normalizedCaseCount;
      
      // Calculate trend (requires historical data - placeholder for MVP)
      const trend = 'stable';
      
      normalized.push({
        disease: disease,
        diseaseLocal: diseaseJa,
        location: {
          country: 'Japan',
          prefecture: prefecture,
          prefectureLocal: prefectureJa,
          state: prefecture // Alias for consistency with US data
        },
        severity: severity,
        trend: trend,
        dataSource: 'e-Stat',
        lastUpdated: year && weekNumber 
          ? `${year}-W${String(weekNumber).padStart(2, '0')}`
          : new Date().toISOString(),
        metrics: {
          caseCount: caseCount,
          per100kPopulation: per100kPopulation,
          normalizedCaseCount: normalizedCaseCount,
          weekNumber: weekNumber,
          year: year
        }
      });
    } catch (error) {
      console.warn('Error normalizing e-Stat record:', error, record);
      // Continue with next record
    }
  }
  
  return normalized;
}

module.exports = {
  normalizeNWSSData,
  normalizeNHSNData,
  normalizeFluViewData,
  normalizeFluSurvData,
  normalizeIDWRData,
  normalizeEStatData,
  normalizeMetric,
  calculateSeverityScore,
  calculateTrend,
  calculateTrendFromPercentChange,
  combineDataSources,
  epiweekToDate,
  OUTBREAK_DATA_SCHEMA,
  SEVERITY_WEIGHTS,
  CDC_BASELINE_VALUES,
  TREND_THRESHOLDS
};
