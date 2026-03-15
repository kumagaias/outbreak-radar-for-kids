/**
 * Integration Test: Japan Data Sources Integration
 * 
 * Verifies that IDWR and e-Stat data sources are properly integrated into
 * the batch processor Lambda handler.
 * 
 * Requirements: 19.31, 19.32
 */

const { handler } = require('../../src/index');

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: jest.fn()
  })),
  GetSecretValueCommand: jest.fn()
}));

// Mock data fetchers
jest.mock('../../src/sources/idwr', () => ({
  fetchWeekData: jest.fn()
}));

jest.mock('../../src/sources/estat', () => ({
  fetchNorovirusData: jest.fn()
}));

jest.mock('../../src/sources/nwss', () => ({
  fetchNWSSData: jest.fn()
}));

jest.mock('../../src/sources/nhsn', () => ({
  fetchStateData: jest.fn()
}));

jest.mock('../../src/sources/fluview', () => ({
  fetchStateData: jest.fn(),
  dateToEpiweek: jest.fn()
}));

jest.mock('../../src/sources/flusurv', () => ({
  fetchLocationData: jest.fn(),
  getRecentEpiweeksRange: jest.fn(() => '202401-202404')
}));

jest.mock('../../src/dynamodb-storage', () => ({
  batchStoreOutbreakData: jest.fn()
}));

const { fetchWeekData: fetchIDWRWeekData } = require('../../src/sources/idwr');
const { fetchNorovirusData: fetchEStatNorovirusData } = require('../../src/sources/estat');
const { fetchNWSSData } = require('../../src/sources/nwss');
const { fetchStateData: fetchNHSNStateData } = require('../../src/sources/nhsn');
const { fetchStateData: fetchFluViewStateData } = require('../../src/sources/fluview');
const { fetchLocationData: fetchFluSurvLocationData } = require('../../src/sources/flusurv');
const { batchStoreOutbreakData } = require('../../src/dynamodb-storage');

describe.skip('Japan Data Sources Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.TARGET_STATES = 'CA,NY';
    process.env.FETCH_JAPAN_DATA = 'true';
    process.env.ESTAT_STATS_DATA_ID = 'test-dataset-id';
    
    // Mock US data sources to return empty arrays
    fetchNWSSData.mockResolvedValue([]);
    fetchNHSNStateData.mockResolvedValue([]);
    fetchFluViewStateData.mockResolvedValue([]);
    fetchFluSurvLocationData.mockResolvedValue([]);
    
    // Mock DynamoDB storage
    batchStoreOutbreakData.mockResolvedValue({
      successCount: 0,
      failureCount: 0
    });
  });

  describe('Requirement 19.31: Background batch processing integration', () => {
    test('should call IDWR fetcher when FETCH_JAPAN_DATA is enabled', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([
        {
          disease: 'Influenza',
          diseaseJa: 'インフルエンザ',
          prefecture: 'Tokyo',
          caseCount: 150,
          reportWeek: 10,
          reportYear: 2024
        }
      ]);
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify IDWR fetcher was called
      expect(fetchIDWRWeekData).toHaveBeenCalled();
      expect(fetchIDWRWeekData).toHaveBeenCalledWith(
        expect.any(Number), // year
        expect.any(Number)  // week
      );
    });

    test('should call e-Stat fetcher when ESTAT_STATS_DATA_ID is configured', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([]);
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([
        {
          disease: 'Norovirus',
          diseaseJa: '感染性胃腸炎',
          prefecture: 'Tokyo',
          caseCount: 200,
          weekNumber: 10,
          year: 2024
        }
      ]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify e-Stat fetcher was called
      expect(fetchEStatNorovirusData).toHaveBeenCalled();
      expect(fetchEStatNorovirusData).toHaveBeenCalledWith(
        expect.objectContaining({
          statsDataId: 'test-dataset-id',
          year: expect.any(Number),
          week: expect.any(Number)
        })
      );
    });

    test('should normalize and store Japan data in DynamoDB', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([
        {
          disease: 'Influenza',
          diseaseJa: 'インフルエンザ',
          prefecture: 'Tokyo',
          caseCount: 150,
          reportWeek: 10,
          reportYear: 2024
        }
      ]);
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([
        {
          disease: 'Norovirus',
          diseaseJa: '感染性胃腸炎',
          prefecture: 'Osaka',
          caseCount: 200,
          weekNumber: 10,
          year: 2024
        }
      ]);
      
      // Mock DynamoDB storage
      batchStoreOutbreakData.mockResolvedValue({
        successCount: 2,
        failureCount: 0
      });
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      const result = await handler(event, context);
      
      // Verify data was stored in DynamoDB
      expect(batchStoreOutbreakData).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.storedCount).toBeGreaterThan(0);
    });

    test('should handle IDWR fetch failure with mock data fallback', async () => {
      // Mock IDWR failure
      fetchIDWRWeekData.mockRejectedValue(new Error('IDWR API unavailable'));
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      const result = await handler(event, context);
      
      // Verify handler completed successfully with fallback
      expect(result.success).toBe(true);
      expect(result.fetchResults.idwr.usingMockData).toBe(true);
    });

    test('should handle e-Stat fetch failure with mock data fallback', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([]);
      
      // Mock e-Stat failure
      fetchEStatNorovirusData.mockRejectedValue(new Error('e-Stat API unavailable'));
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      const result = await handler(event, context);
      
      // Verify handler completed successfully with fallback
      expect(result.success).toBe(true);
      expect(result.fetchResults.estat.usingMockData).toBe(true);
    });
  });

  describe('Requirement 19.32: Weekly update schedule', () => {
    test('should fetch current week data from IDWR', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([
        {
          disease: 'RSV',
          diseaseJa: 'RSウイルス感染症',
          prefecture: 'Tokyo',
          caseCount: 100,
          reportWeek: 10,
          reportYear: 2024
        }
      ]);
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify IDWR fetcher was called with current year and week
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      
      expect(fetchIDWRWeekData).toHaveBeenCalledWith(
        currentYear,
        expect.any(Number) // week number
      );
    });

    test('should fetch current week data from e-Stat', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([]);
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([
        {
          disease: 'Norovirus',
          diseaseJa: '感染性胃腸炎',
          prefecture: 'Tokyo',
          caseCount: 200,
          weekNumber: 10,
          year: 2024
        }
      ]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify e-Stat fetcher was called with current year and week
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      
      expect(fetchEStatNorovirusData).toHaveBeenCalledWith(
        expect.objectContaining({
          year: currentYear,
          week: expect.any(Number)
        })
      );
    });
  });

  describe('Timeout handling for unstable Japan data sources', () => {
    test('should handle IDWR timeout with retry and fallback', async () => {
      // Mock IDWR timeout
      fetchIDWRWeekData.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 100)
        )
      );
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      const result = await handler(event, context);
      
      // Verify handler completed with fallback
      expect(result.success).toBe(true);
      expect(result.fetchResults.idwr.usingMockData).toBe(true);
    });

    test('should handle e-Stat timeout with retry and fallback', async () => {
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([]);
      
      // Mock e-Stat timeout
      fetchEStatNorovirusData.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 100)
        )
      );
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      const result = await handler(event, context);
      
      // Verify handler completed with fallback
      expect(result.success).toBe(true);
      expect(result.fetchResults.estat.usingMockData).toBe(true);
    });
  });

  describe('FETCH_JAPAN_DATA flag', () => {
    test('should skip Japan data sources when FETCH_JAPAN_DATA is false', async () => {
      process.env.FETCH_JAPAN_DATA = 'false';
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify Japan fetchers were not called
      expect(fetchIDWRWeekData).not.toHaveBeenCalled();
      expect(fetchEStatNorovirusData).not.toHaveBeenCalled();
    });

    test('should fetch Japan data sources when FETCH_JAPAN_DATA is true', async () => {
      process.env.FETCH_JAPAN_DATA = 'true';
      
      // Mock Japan data
      fetchIDWRWeekData.mockResolvedValue([]);
      fetchEStatNorovirusData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify Japan fetchers were called
      expect(fetchIDWRWeekData).toHaveBeenCalled();
      expect(fetchEStatNorovirusData).toHaveBeenCalled();
    });
  });

  describe('e-Stat dataset ID configuration', () => {
    test('should use mock data when ESTAT_STATS_DATA_ID is not configured', async () => {
      delete process.env.ESTAT_STATS_DATA_ID;
      
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      const result = await handler(event, context);
      
      // Verify e-Stat fetcher was not called
      expect(fetchEStatNorovirusData).not.toHaveBeenCalled();
      
      // Verify mock data was used
      expect(result.fetchResults.estat.usingMockData).toBe(true);
    });

    test('should call e-Stat API when ESTAT_STATS_DATA_ID is configured', async () => {
      process.env.ESTAT_STATS_DATA_ID = 'test-dataset-id';
      
      // Mock IDWR data
      fetchIDWRWeekData.mockResolvedValue([]);
      
      // Mock e-Stat data
      fetchEStatNorovirusData.mockResolvedValue([]);
      
      const event = {};
      const context = { requestId: 'test-request-id' };
      
      await handler(event, context);
      
      // Verify e-Stat fetcher was called
      expect(fetchEStatNorovirusData).toHaveBeenCalled();
    });
  });
});
