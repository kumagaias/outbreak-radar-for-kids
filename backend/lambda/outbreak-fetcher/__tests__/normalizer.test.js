/**
 * Unit tests for Data Normalizer and Severity Calculator
 * 
 * Tests data normalization, severity calculation, and trend analysis
 */

const {
  normalizeNWSSData,
  normalizeNHSNData,
  normalizeFluViewData,
  normalizeFluSurvData,
  normalizeMetric,
  calculateSeverityScore,
  calculateTrend,
  calculateTrendFromPercentChange,
  combineDataSources,
  epiweekToDate,
  SEVERITY_WEIGHTS,
  CDC_BASELINE_VALUES,
  TREND_THRESHOLDS
} = require('../src/normalizer');

describe('Data Normalizer', () => {
  describe('normalizeMetric', () => {
    it('should normalize metric using Min-Max Scaling', () => {
      const historical = { min: 0, max: 100 };
      
      expect(normalizeMetric(0, historical, 50)).toBe(0);
      expect(normalizeMetric(50, historical, 50)).toBe(50);
      expect(normalizeMetric(100, historical, 50)).toBe(100);
    });
    
    it('should use baseline values for cold start', () => {
      const historical = {};
      const baseline = 50;
      
      // With no historical data, uses baseline * 0.5 as min, baseline * 2.0 as max
      const result = normalizeMetric(baseline, historical, baseline);
      
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });
    
    it('should clamp values to 0-100 range', () => {
      const historical = { min: 0, max: 100 };
      
      expect(normalizeMetric(-50, historical, 50)).toBe(0);
      expect(normalizeMetric(150, historical, 50)).toBe(100);
    });
    
    it('should handle null/undefined values', () => {
      const historical = { min: 0, max: 100 };
      
      expect(normalizeMetric(null, historical, 50)).toBe(0);
      expect(normalizeMetric(undefined, historical, 50)).toBe(0);
      expect(normalizeMetric(NaN, historical, 50)).toBe(0);
    });
    
    it('should return 50 when min equals max', () => {
      const historical = { min: 50, max: 50 };
      
      expect(normalizeMetric(50, historical, 50)).toBe(50);
    });
  });
  
  describe('normalizeNWSSData', () => {
    it('should normalize NWSS wastewater data', () => {
      const nwssData = [
        {
          diseaseName: 'COVID-19',
          geographicUnit: {
            stateOrPrefecture: 'CA',
            countyOrWard: 'Los Angeles'
          },
          metrics: {
            wastewaterActivityLevel: 75,
            detectionProportion: 85,
            percentChange15d: 15.5,
            rawPercentile: 75
          },
          date: '2024-03-01',
          timestamp: '2024-03-01T00:00:00Z'
        }
      ];
      
      const normalized = normalizeNWSSData(nwssData);
      
      expect(normalized.length).toBe(1);
      expect(normalized[0].disease).toBe('COVID-19');
      expect(normalized[0].location.state).toBe('CA');
      expect(normalized[0].location.county).toBe('Los Angeles');
      expect(normalized[0].dataSource).toBe('CDC NWSS');
      expect(normalized[0].trend).toBe('increasing'); // 15.5% > 10% threshold
      expect(normalized[0].metrics.wastewaterActivityLevel).toBeGreaterThanOrEqual(0);
      expect(normalized[0].metrics.wastewaterActivityLevel).toBeLessThanOrEqual(100);
    });
    
    it('should handle empty NWSS data', () => {
      expect(normalizeNWSSData([])).toEqual([]);
      expect(normalizeNWSSData(null)).toEqual([]);
    });
    
    it('should skip invalid NWSS records', () => {
      const nwssData = [
        {
          diseaseName: 'COVID-19',
          // Missing geographicUnit
          metrics: {
            wastewaterActivityLevel: 75
          },
          date: '2024-03-01'
        }
      ];
      
      const normalized = normalizeNWSSData(nwssData);
      
      expect(normalized.length).toBe(0);
    });
  });
  
  describe('normalizeNHSNData', () => {
    it('should normalize NHSN hospital admission data', () => {
      const nhsnData = [
        {
          state: 'CA',
          weekEndingDate: '2024-03-01',
          diseases: [
            {
              disease: 'COVID-19',
              admissions: 1500,
              admissionsPer100k: 3.8
            },
            {
              disease: 'Influenza',
              admissions: 800,
              admissionsPer100k: 2.0
            }
          ]
        }
      ];
      
      const normalized = normalizeNHSNData(nhsnData);
      
      expect(normalized.length).toBe(2);
      expect(normalized[0].disease).toBe('COVID-19');
      expect(normalized[0].location.state).toBe('CA');
      expect(normalized[0].location.county).toBeNull();
      expect(normalized[0].dataSource).toBe('CDC NHSN');
      expect(normalized[0].metrics.rawAdmissions).toBe(1500);
      expect(normalized[1].disease).toBe('Influenza');
    });
    
    it('should handle empty NHSN data', () => {
      expect(normalizeNHSNData([])).toEqual([]);
      expect(normalizeNHSNData(null)).toEqual([]);
    });
  });
  
  describe('normalizeFluViewData', () => {
    it('should normalize FluView ILI data', () => {
      const fluviewData = [
        {
          region: 'ca',
          iliPercentage: 3.5,
          epiweek: 202410,
          year: 2024,
          week: 10
        }
      ];
      
      const normalized = normalizeFluViewData(fluviewData);
      
      expect(normalized.length).toBe(1);
      expect(normalized[0].disease).toBe('Influenza-like Illness');
      expect(normalized[0].location.state).toBe('CA');
      expect(normalized[0].dataSource).toBe('Delphi Epidata FluView');
      expect(normalized[0].metrics.rawILIPercentage).toBe(3.5);
    });
    
    it('should handle HHS region data', () => {
      const fluviewData = [
        {
          region: 'hhs9',
          iliPercentage: 3.5,
          epiweek: 202410,
          year: 2024,
          week: 10
        }
      ];
      
      const normalized = normalizeFluViewData(fluviewData);
      
      expect(normalized.length).toBe(1);
      expect(normalized[0].location.state).toBeNull(); // HHS region, not state
    });
    
    it('should handle empty FluView data', () => {
      expect(normalizeFluViewData([])).toEqual([]);
      expect(normalizeFluViewData(null)).toEqual([]);
    });
  });
  
  describe('normalizeFluSurvData', () => {
    it('should normalize FluSurv-NET hospitalization rate data', () => {
      const flusurvData = [
        {
          location: 'ca',
          ageGroupRates: {
            '0-1': 5.2,
            '1-4': 3.8,
            '5-11': 2.1
          },
          overallRate: 3.5,
          epiweek: 202410,
          year: 2024,
          week: 10
        }
      ];
      
      const normalized = normalizeFluSurvData(flusurvData);
      
      expect(normalized.length).toBe(1);
      expect(normalized[0].disease).toBe('Influenza');
      expect(normalized[0].location.state).toBe('CA');
      expect(normalized[0].dataSource).toBe('Delphi Epidata FluSurv-NET');
      expect(normalized[0].metrics.rawRate).toBe(3.5);
      expect(normalized[0].metrics.ageGroupRates).toEqual({
        '0-1': 5.2,
        '1-4': 3.8,
        '5-11': 2.1
      });
    });
    
    it('should handle network_all location', () => {
      const flusurvData = [
        {
          location: 'network_all',
          ageGroupRates: { '0-1': 5.2 },
          overallRate: 3.5,
          epiweek: 202410,
          year: 2024,
          week: 10
        }
      ];
      
      const normalized = normalizeFluSurvData(flusurvData);
      
      expect(normalized.length).toBe(1);
      expect(normalized[0].location.state).toBeNull(); // Network-wide, not state
    });
    
    it('should handle empty FluSurv-NET data', () => {
      expect(normalizeFluSurvData([])).toEqual([]);
      expect(normalizeFluSurvData(null)).toEqual([]);
    });
  });
  
  describe('calculateSeverityScore', () => {
    it('should calculate severity with default weights', () => {
      const metrics = {
        wastewater: 80,
        ili: 60,
        hospitalAdmissions: 70,
        hospitalizationRate: 50
      };
      
      const severity = calculateSeverityScore(metrics, false, true);
      
      // Expected: 80*0.4 + 60*0.3 + 70*0.2 + 50*0.1 = 32 + 18 + 14 + 5 = 69
      expect(severity).toBeCloseTo(69, 1);
    });
    
    it('should increase wastewater weight when uptrend detected', () => {
      const metrics = {
        wastewater: 80,
        ili: 60,
        hospitalAdmissions: 70,
        hospitalizationRate: 50
      };
      
      const severityUptrend = calculateSeverityScore(metrics, true, true);
      const severityNormal = calculateSeverityScore(metrics, false, true);
      
      // Uptrend should give higher weight to wastewater (50% vs 40%)
      expect(severityUptrend).toBeGreaterThan(severityNormal);
    });
    
    it('should redistribute weights when WastewaterSCAN unavailable', () => {
      const metrics = {
        wastewater: 80,
        ili: 60,
        hospitalAdmissions: 70,
        hospitalizationRate: 50
      };
      
      const severity = calculateSeverityScore(metrics, false, false);
      
      // Expected: 80*0.4 + 60*0.35 + 70*0.15 + 50*0.1 = 32 + 21 + 10.5 + 5 = 68.5
      expect(severity).toBeCloseTo(68.5, 1);
    });
    
    it('should handle missing data sources', () => {
      const metrics = {
        wastewater: 80,
        ili: 60
        // Missing hospitalAdmissions and hospitalizationRate
      };
      
      const severity = calculateSeverityScore(metrics, false, true);
      
      // Should normalize by total weight (0.4 + 0.3 = 0.7)
      // Expected: (80*0.4 + 60*0.3) / 0.7 = (32 + 18) / 0.7 = 71.43
      expect(severity).toBeCloseTo(71.43, 1);
    });
    
    it('should return 0 when all metrics missing', () => {
      const metrics = {};
      
      const severity = calculateSeverityScore(metrics, false, true);
      
      expect(severity).toBe(0);
    });
  });
  
  describe('calculateTrendFromPercentChange', () => {
    it('should detect increasing trend', () => {
      expect(calculateTrendFromPercentChange(15)).toBe('increasing');
      expect(calculateTrendFromPercentChange(10)).toBe('increasing');
    });
    
    it('should detect decreasing trend', () => {
      expect(calculateTrendFromPercentChange(-15)).toBe('decreasing');
      expect(calculateTrendFromPercentChange(-10)).toBe('decreasing');
    });
    
    it('should detect stable trend', () => {
      expect(calculateTrendFromPercentChange(5)).toBe('stable');
      expect(calculateTrendFromPercentChange(-5)).toBe('stable');
      expect(calculateTrendFromPercentChange(0)).toBe('stable');
    });
    
    it('should handle null/undefined values', () => {
      expect(calculateTrendFromPercentChange(null)).toBe('stable');
      expect(calculateTrendFromPercentChange(undefined)).toBe('stable');
      expect(calculateTrendFromPercentChange(NaN)).toBe('stable');
    });
  });
  
  describe('calculateTrend', () => {
    it('should calculate trend from time series data', () => {
      const timeSeries = [
        { date: '2024-03-01', value: 100 },
        { date: '2024-03-08', value: 110 },
        { date: '2024-03-15', value: 120 },
        { date: '2024-03-22', value: 135 }
      ];
      
      const trend = calculateTrend(timeSeries, 4);
      
      // 35% increase over 4 weeks
      expect(trend).toBe('increasing');
    });
    
    it('should detect decreasing trend', () => {
      const timeSeries = [
        { date: '2024-03-01', value: 100 },
        { date: '2024-03-08', value: 90 },
        { date: '2024-03-15', value: 80 },
        { date: '2024-03-22', value: 70 }
      ];
      
      const trend = calculateTrend(timeSeries, 4);
      
      // 30% decrease over 4 weeks
      expect(trend).toBe('decreasing');
    });
    
    it('should detect stable trend', () => {
      const timeSeries = [
        { date: '2024-03-01', value: 100 },
        { date: '2024-03-08', value: 102 },
        { date: '2024-03-15', value: 98 },
        { date: '2024-03-22', value: 101 }
      ];
      
      const trend = calculateTrend(timeSeries, 4);
      
      // 1% change over 4 weeks
      expect(trend).toBe('stable');
    });
    
    it('should handle insufficient data', () => {
      expect(calculateTrend([], 4)).toBe('stable');
      expect(calculateTrend([{ date: '2024-03-01', value: 100 }], 4)).toBe('stable');
    });
    
    it('should filter out null values', () => {
      const timeSeries = [
        { date: '2024-03-01', value: 100 },
        { date: '2024-03-08', value: null },
        { date: '2024-03-15', value: 120 }
      ];
      
      const trend = calculateTrend(timeSeries, 4);
      
      expect(trend).toBe('increasing');
    });
  });
  
  describe('epiweekToDate', () => {
    it('should convert epiweek to ISO date', () => {
      const date = epiweekToDate(2024, 10);
      
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(date).toContain('2024');
    });
    
    it('should handle week 1', () => {
      const date = epiweekToDate(2024, 1);
      
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Week 1 starts on January 1st
      expect(date).toBe('2024-01-01');
    });
    
    it('should handle week 52', () => {
      const date = epiweekToDate(2024, 52);
      
      expect(date).toContain('2024-12');
    });
  });
  
  describe('combineDataSources', () => {
    it('should combine data from multiple sources for same disease and location', () => {
      const normalizedData = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-03-01',
          trend: 'increasing',
          metrics: { wastewaterActivityLevel: 80 }
        },
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NHSN',
          lastUpdated: '2024-03-01',
          trend: 'stable',
          metrics: { hospitalAdmissions: 70 }
        },
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'Delphi Epidata FluView',
          lastUpdated: '2024-03-01',
          trend: 'stable',
          metrics: { iliPercentage: 60 }
        }
      ];
      
      const combined = combineDataSources(normalizedData);
      
      expect(combined.length).toBe(1);
      expect(combined[0].disease).toBe('COVID-19');
      expect(combined[0].location.state).toBe('CA');
      expect(combined[0].dataSource).toContain('CDC NWSS');
      expect(combined[0].dataSource).toContain('CDC NHSN');
      expect(combined[0].dataSource).toContain('Delphi Epidata FluView');
      expect(combined[0].severity).toBeGreaterThan(0);
      expect(combined[0].trend).toBe('increasing'); // Prioritizes wastewater trend
    });
    
    it('should keep separate entries for different diseases', () => {
      const normalizedData = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-03-01',
          trend: 'increasing',
          metrics: { wastewaterActivityLevel: 80 }
        },
        {
          disease: 'Influenza',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NHSN',
          lastUpdated: '2024-03-01',
          trend: 'stable',
          metrics: { hospitalAdmissions: 70 }
        }
      ];
      
      const combined = combineDataSources(normalizedData);
      
      expect(combined.length).toBe(2);
      expect(combined.find(d => d.disease === 'COVID-19')).toBeDefined();
      expect(combined.find(d => d.disease === 'Influenza')).toBeDefined();
    });
    
    it('should keep separate entries for different locations', () => {
      const normalizedData = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-03-01',
          trend: 'increasing',
          metrics: { wastewaterActivityLevel: 80 }
        },
        {
          disease: 'COVID-19',
          location: { state: 'NY', county: null },
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-03-01',
          trend: 'stable',
          metrics: { wastewaterActivityLevel: 60 }
        }
      ];
      
      const combined = combineDataSources(normalizedData);
      
      expect(combined.length).toBe(2);
      expect(combined.find(d => d.location.state === 'CA')).toBeDefined();
      expect(combined.find(d => d.location.state === 'NY')).toBeDefined();
    });
    
    it('should use most recent lastUpdated date', () => {
      const normalizedData = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-03-01',
          trend: 'increasing',
          metrics: { wastewaterActivityLevel: 80 }
        },
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          dataSource: 'CDC NHSN',
          lastUpdated: '2024-03-05',
          trend: 'stable',
          metrics: { hospitalAdmissions: 70 }
        }
      ];
      
      const combined = combineDataSources(normalizedData);
      
      expect(combined[0].lastUpdated).toBe('2024-03-05');
    });
    
    it('should handle empty data', () => {
      expect(combineDataSources([])).toEqual([]);
      expect(combineDataSources(null)).toEqual([]);
    });
  });
  
  describe('Constants', () => {
    it('should define severity weights', () => {
      expect(SEVERITY_WEIGHTS.DEFAULT).toBeDefined();
      expect(SEVERITY_WEIGHTS.DEFAULT.wastewater).toBe(0.40);
      expect(SEVERITY_WEIGHTS.DEFAULT.ili).toBe(0.30);
      expect(SEVERITY_WEIGHTS.DEFAULT.hospitalAdmissions).toBe(0.20);
      expect(SEVERITY_WEIGHTS.DEFAULT.hospitalizationRate).toBe(0.10);
    });
    
    it('should define wastewater uptrend weights', () => {
      expect(SEVERITY_WEIGHTS.WASTEWATER_UPTREND).toBeDefined();
      expect(SEVERITY_WEIGHTS.WASTEWATER_UPTREND.wastewater).toBe(0.50);
      expect(SEVERITY_WEIGHTS.WASTEWATER_UPTREND.wastewater).toBeGreaterThan(
        SEVERITY_WEIGHTS.DEFAULT.wastewater
      );
    });
    
    it('should define no WastewaterSCAN weights', () => {
      expect(SEVERITY_WEIGHTS.NO_WASTEWATERSCAN).toBeDefined();
      expect(SEVERITY_WEIGHTS.NO_WASTEWATERSCAN.wastewater).toBe(0.40);
      expect(SEVERITY_WEIGHTS.NO_WASTEWATERSCAN.ili).toBe(0.35);
    });
    
    it('should define CDC baseline values', () => {
      expect(CDC_BASELINE_VALUES).toBeDefined();
      expect(CDC_BASELINE_VALUES.wastewaterActivityLevel).toBe(5);
      expect(CDC_BASELINE_VALUES.iliPercentage).toBe(2.5);
      expect(CDC_BASELINE_VALUES.hospitalAdmissions).toBe(1000);
      expect(CDC_BASELINE_VALUES.hospitalizationRate).toBe(5);
    });
    
    it('should define trend thresholds', () => {
      expect(TREND_THRESHOLDS).toBeDefined();
      expect(TREND_THRESHOLDS.INCREASING).toBe(0.10);
      expect(TREND_THRESHOLDS.DECREASING).toBe(-0.10);
    });
  });
});
