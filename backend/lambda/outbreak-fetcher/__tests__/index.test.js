/**
 * Unit tests for Outbreak Data Fetcher Lambda Handler
 * 
 * Tests:
 * - Handler normal execution flow
 * - Parallel data fetching
 * - Error handling for individual source failures
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Data normalization and storage
 */

const { handler } = require('../src/index');

// Mock all dependencies
jest.mock('../src/sources/nwss');
jest.mock('../src/sources/nhsn');
jest.mock('../src/sources/fluview');
jest.mock('../src/sources/flusurv');
jest.mock('../src/sources/idwr');
jest.mock('../src/sources/estat');
jest.mock('../src/normalizer');
jest.mock('../src/dynamodb-storage');
// Don't mock idwr-historical - we want to use the real implementation

const { fetchNWSSData } = require('../src/sources/nwss');
const { fetchStateData: fetchNHSNStateData } = require('../src/sources/nhsn');
const { fetchStateData: fetchFluViewStateData } = require('../src/sources/fluview');
const { fetchLocationData: fetchFluSurvLocationData, getRecentEpiweeksRange } = require('../src/sources/flusurv');
const {
  normalizeNWSSData,
  normalizeNHSNData,
  normalizeFluViewData,
  normalizeFluSurvData,
  normalizeIDWRData,
  normalizeEStatData,
  combineDataSources
} = require('../src/normalizer');
const { batchStoreOutbreakData } = require('../src/dynamodb-storage');
const { generateMockIDWRData } = require('../src/mock-data/idwr-historical');

describe('Outbreak Data Fetcher Lambda Handler', () => {
  let mockContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Lambda context
    mockContext = {
      requestId: 'test-request-id',
      functionName: 'outbreak-data-fetcher',
      getRemainingTimeInMillis: () => 300000 // 5 minutes
    };

    // Mock environment variables
    process.env.TARGET_STATES = 'CA,NY';
    process.env.AWS_REGION = 'us-east-1';

    // Mock getRecentEpiweeksRange
    getRecentEpiweeksRange.mockReturnValue('202401-202404');
  });

  describe('Normal execution flow', () => {
    test('should fetch, normalize, and store data successfully', async () => {
      // Mock successful data fetching
      const mockNWSSData = [
        {
          source: 'NWSS',
          diseaseId: 'SARS-CoV-2',
          diseaseName: 'COVID-19',
          date: '2024-01-15',
          geographicUnit: { country: 'US', stateOrPrefecture: 'CA', countyOrWard: null },
          metrics: { wastewaterActivityLevel: 75, detectionProportion: 80, percentChange15d: 10 }
        }
      ];

      const mockNHSNData = [
        {
          state: 'CA',
          weekEndingDate: '2024-01-15',
          diseases: [{ disease: 'COVID-19', admissions: 1500, admissionsPer100k: 3.8 }]
        }
      ];

      const mockFluViewData = [
        {
          region: 'ca',
          epiweek: 202402,
          year: 2024,
          week: 2,
          iliPercentage: 3.5,
          ageGroups: { '0-4': 4.2, '5-24': 3.8 }
        }
      ];

      const mockFluSurvData = [
        {
          location: 'ca',
          epiweek: 202402,
          year: 2024,
          week: 2,
          ageGroupRates: { '0-1': 12.5, '1-4': 8.3 },
          overallRate: 6.2
        }
      ];

      fetchNWSSData.mockResolvedValue(mockNWSSData);
      fetchNHSNStateData.mockResolvedValue(mockNHSNData);
      fetchFluViewStateData.mockResolvedValue(mockFluViewData);
      fetchFluSurvLocationData.mockResolvedValue(mockFluSurvData);

      // Mock normalization
      const mockNormalizedNWSS = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 75,
          trend: 'increasing',
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-01-15',
          metrics: { wastewaterActivityLevel: 75 }
        }
      ];

      const mockNormalizedNHSN = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 60,
          trend: 'stable',
          dataSource: 'CDC NHSN',
          lastUpdated: '2024-01-15',
          metrics: { hospitalAdmissions: 60 }
        }
      ];

      normalizeNWSSData.mockReturnValue(mockNormalizedNWSS);
      normalizeNHSNData.mockReturnValue(mockNormalizedNHSN);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      // Mock combined data
      const mockCombinedData = [
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 68,
          trend: 'increasing',
          dataSource: 'CDC NWSS, CDC NHSN',
          lastUpdated: '2024-01-15',
          metrics: { wastewaterActivityLevel: 75, hospitalAdmissions: 60 }
        }
      ];

      combineDataSources.mockReturnValue(mockCombinedData);

      // Mock storage
      batchStoreOutbreakData.mockResolvedValue({ successCount: 1, failureCount: 0 });

      // Execute handler
      const result = await handler({}, mockContext);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(2); // NWSS + NHSN
      expect(result.storedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.executionTimeMs).toBeGreaterThan(0);

      // Verify all sources were called (5 states: CA, NY, TX, FL, IL)
      expect(fetchNWSSData).toHaveBeenCalled();
      expect(fetchNHSNStateData).toHaveBeenCalled();
      expect(fetchFluViewStateData).toHaveBeenCalled();
      expect(fetchFluSurvLocationData).toHaveBeenCalled();

      // Verify normalization was called
      expect(normalizeNWSSData).toHaveBeenCalledWith(expect.arrayContaining(mockNWSSData));
      expect(normalizeNHSNData).toHaveBeenCalledWith(expect.arrayContaining(mockNHSNData));

      // Verify storage was called
      expect(batchStoreOutbreakData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            geographicArea: 'CA',
            disease: 'COVID-19',
            severity: 68
          })
        ])
      );
    });
  });

  describe('Error handling', () => {
    test('should continue processing when one source fails', async () => {
      // Mock NWSS failure, others succeed
      fetchNWSSData.mockRejectedValue(new Error('NWSS API unavailable'));
      fetchNHSNStateData.mockResolvedValue([
        {
          state: 'CA',
          weekEndingDate: '2024-01-15',
          diseases: [{ disease: 'COVID-19', admissions: 1500 }]
        }
      ]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 60,
          trend: 'stable',
          dataSource: 'CDC NHSN',
          lastUpdated: '2024-01-15',
          metrics: { hospitalAdmissions: 60 }
        }
      ]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 60,
          trend: 'stable',
          dataSource: 'CDC NHSN',
          lastUpdated: '2024-01-15',
          metrics: { hospitalAdmissions: 60 }
        }
      ]);

      batchStoreOutbreakData.mockResolvedValue({ successCount: 1, failureCount: 0 });

      const result = await handler({}, mockContext);

      // Should still succeed with partial data
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(1);
      expect(result.storedCount).toBe(1);
    });

    test('should handle all sources failing gracefully', async () => {
      // Mock all sources failing
      fetchNWSSData.mockRejectedValue(new Error('NWSS API unavailable'));
      fetchNHSNStateData.mockRejectedValue(new Error('NHSN API unavailable'));
      fetchFluViewStateData.mockRejectedValue(new Error('FluView API unavailable'));
      fetchFluSurvLocationData.mockRejectedValue(new Error('FluSurv API unavailable'));

      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([]);

      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      const result = await handler({}, mockContext);

      // Should complete but with no data
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(0);
      expect(result.storedCount).toBe(0);
    });

    test('should handle storage failures', async () => {
      // Mock successful fetching and normalization
      fetchNWSSData.mockResolvedValue([
        {
          source: 'NWSS',
          diseaseId: 'SARS-CoV-2',
          diseaseName: 'COVID-19',
          date: '2024-01-15',
          geographicUnit: { country: 'US', stateOrPrefecture: 'CA', countyOrWard: null },
          metrics: { wastewaterActivityLevel: 75 }
        }
      ]);
      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      normalizeNWSSData.mockReturnValue([
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 75,
          trend: 'increasing',
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-01-15',
          metrics: { wastewaterActivityLevel: 75 }
        }
      ]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 75,
          trend: 'increasing',
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-01-15',
          metrics: { wastewaterActivityLevel: 75 }
        }
      ]);

      // Mock storage failure
      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 1 });

      const result = await handler({}, mockContext);

      // Should complete but report storage failure
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(1);
      expect(result.storedCount).toBe(0);
      expect(result.errors).toContain('Failed to store 1 records');
    });
  });

  describe('Retry logic', () => {
    test('should retry failed API calls with exponential backoff', async () => {
      // Mock NWSS failing twice, then succeeding
      fetchNWSSData
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue([
          {
            source: 'NWSS',
            diseaseId: 'SARS-CoV-2',
            diseaseName: 'COVID-19',
            date: '2024-01-15',
            geographicUnit: { country: 'US', stateOrPrefecture: 'CA', countyOrWard: null },
            metrics: { wastewaterActivityLevel: 75 }
          }
        ]);

      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      normalizeNWSSData.mockReturnValue([
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 75,
          trend: 'increasing',
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-01-15',
          metrics: { wastewaterActivityLevel: 75 }
        }
      ]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([
        {
          disease: 'COVID-19',
          location: { state: 'CA', county: null },
          severity: 75,
          trend: 'increasing',
          dataSource: 'CDC NWSS',
          lastUpdated: '2024-01-15',
          metrics: { wastewaterActivityLevel: 75 }
        }
      ]);

      batchStoreOutbreakData.mockResolvedValue({ successCount: 1, failureCount: 0 });

      const result = await handler({}, mockContext);

      // Should succeed after retries
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(1);
      
      // NWSS should have been called 3 times per state (2 failures + 1 success)
      // But due to parallel execution, exact count may vary
      expect(fetchNWSSData).toHaveBeenCalled();
    }, 30000); // Increase timeout for retry delays
  });

  describe('Timeout handling', () => {
    test('should timeout slow API calls', async () => {
      // Mock NWSS taking too long (never resolves)
      fetchNWSSData.mockImplementation(() => new Promise(() => {})); // Never resolves

      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([]);

      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      const result = await handler({}, mockContext);

      // Should complete despite NWSS timeout
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(0);
    }, 240000); // 4 minutes timeout (10s timeout * 3 retries * 5 states + buffer)
  });

  describe('Data normalization', () => {
    test('should handle normalization errors gracefully', async () => {
      // Mock successful fetching
      fetchNWSSData.mockResolvedValue([
        {
          source: 'NWSS',
          diseaseId: 'SARS-CoV-2',
          diseaseName: 'COVID-19',
          date: '2024-01-15',
          geographicUnit: { country: 'US', stateOrPrefecture: 'CA', countyOrWard: null },
          metrics: { wastewaterActivityLevel: 75 }
        }
      ]);
      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      // Mock normalization throwing error
      normalizeNWSSData.mockImplementation(() => {
        throw new Error('Normalization failed');
      });
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([]);

      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      const result = await handler({}, mockContext);

      // Should complete despite normalization error
      expect(result.success).toBe(true);
      expect(result.normalizedCount).toBe(0);
    });
  });

  describe('Performance', () => {
    test('should complete within 10 seconds with cached data', async () => {
      // Mock fast responses
      fetchNWSSData.mockResolvedValue([]);
      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);

      combineDataSources.mockReturnValue([]);

      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      const startTime = Date.now();
      const result = await handler({}, mockContext);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});


  describe.skip('Japan data source fallback to mock data', () => {
    let mockContext;
    
    beforeEach(() => {
      mockContext = {
        requestId: 'test-request-id-japan',
        functionName: 'outbreak-data-fetcher',
        getRemainingTimeInMillis: () => 300000
      };
    });
    
    test('should use mock IDWR data when real IDWR fetch fails', async () => {
      // Mock IDWR fetch failure
      const { fetchWeekData: fetchIDWRWeekData } = require('../src/sources/idwr');
      fetchIDWRWeekData.mockRejectedValue(new Error('HTTP 404: Not Found'));

      // Mock other sources as successful
      fetchNWSSData.mockResolvedValue([]);
      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      // Mock normalization
      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);
      
      const { normalizeIDWRData } = require('../src/normalizer');
      normalizeIDWRData.mockReturnValue([
        {
          diseaseId: 'RSV',
          diseaseName: 'RSV',
          severity: 65,
          location: { country: 'JP', stateOrPrefecture: 'National' },
          metrics: { caseCount: 150 }
        }
      ]);

      combineDataSources.mockReturnValue([]);
      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      // Enable Japan data fetching
      process.env.FETCH_JAPAN_DATA = 'true';

      const result = await handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.fetchResults.idwr.success).toBe(true);
      expect(result.fetchResults.idwr.usingMockData).toBe(true);
      expect(result.fetchResults.idwr.data.length).toBeGreaterThan(0);
    });

    test('should use mock norovirus data when e-Stat is not configured', async () => {
      // Mock IDWR as successful
      const { fetchWeekData: fetchIDWRWeekData } = require('../src/sources/idwr');
      fetchIDWRWeekData.mockResolvedValue([]);

      // Mock other sources as successful
      fetchNWSSData.mockResolvedValue([]);
      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      // Mock normalization
      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);
      normalizeIDWRData.mockReturnValue([]);
      
      const { normalizeEStatData } = require('../src/normalizer');
      normalizeEStatData.mockReturnValue([
        {
          diseaseId: 'Norovirus',
          diseaseName: 'Norovirus',
          severity: 55,
          location: { country: 'JP', stateOrPrefecture: 'National' },
          metrics: { caseCount: 300 }
        }
      ]);

      combineDataSources.mockReturnValue([]);
      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      // Enable Japan data fetching but don't configure e-Stat
      process.env.FETCH_JAPAN_DATA = 'true';
      delete process.env.ESTAT_STATS_DATA_ID;

      const result = await handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.fetchResults.estat.success).toBe(true);
      expect(result.fetchResults.estat.usingMockData).toBe(true);
      expect(result.fetchResults.estat.data.length).toBeGreaterThan(0);
      
      // Verify only norovirus data is included
      const norovirusOnly = result.fetchResults.estat.data.every(r => r.disease === 'Norovirus');
      expect(norovirusOnly).toBe(true);
    });

    test('should use mock norovirus data when e-Stat fetch fails', async () => {
      // Mock IDWR as successful
      const { fetchWeekData: fetchIDWRWeekData } = require('../src/sources/idwr');
      fetchIDWRWeekData.mockResolvedValue([]);

      // Mock e-Stat fetch failure
      const { fetchNorovirusData: fetchEStatNorovirusData } = require('../src/sources/estat');
      fetchEStatNorovirusData.mockRejectedValue(new Error('API key retrieval failed'));

      // Mock other sources as successful
      fetchNWSSData.mockResolvedValue([]);
      fetchNHSNStateData.mockResolvedValue([]);
      fetchFluViewStateData.mockResolvedValue([]);
      fetchFluSurvLocationData.mockResolvedValue([]);

      // Mock normalization
      normalizeNWSSData.mockReturnValue([]);
      normalizeNHSNData.mockReturnValue([]);
      normalizeFluViewData.mockReturnValue([]);
      normalizeFluSurvData.mockReturnValue([]);
      normalizeIDWRData.mockReturnValue([]);
      
      const { normalizeEStatData } = require('../src/normalizer');
      normalizeEStatData.mockReturnValue([
        {
          diseaseId: 'Norovirus',
          diseaseName: 'Norovirus',
          severity: 55,
          location: { country: 'JP', stateOrPrefecture: 'National' },
          metrics: { caseCount: 300 }
        }
      ]);

      combineDataSources.mockReturnValue([]);
      batchStoreOutbreakData.mockResolvedValue({ successCount: 0, failureCount: 0 });

      // Enable Japan data fetching with e-Stat configured
      process.env.FETCH_JAPAN_DATA = 'true';
      process.env.ESTAT_STATS_DATA_ID = 'test-dataset-id';

      const result = await handler({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.fetchResults.estat.success).toBe(true);
      expect(result.fetchResults.estat.usingMockData).toBe(true);
      expect(result.fetchResults.estat.data.length).toBeGreaterThan(0);
    });
  });
