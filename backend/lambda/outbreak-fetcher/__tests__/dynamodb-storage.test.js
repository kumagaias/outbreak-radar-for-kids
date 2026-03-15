/**
 * Tests for DynamoDB Storage Module
 * 
 * Tests storage and retrieval of normalized outbreak data
 * Requirements: 19.15, 19.16, 19.31
 */

// Mock AWS SDK before requiring the module
const mockSend = jest.fn();
const mockDynamoDBClient = jest.fn().mockImplementation(() => ({}));

// Store command inputs for verification
const commandStore = {
  lastPutCommand: null,
  lastQueryCommand: null,
  lastBatchWriteCommand: null
};

// Create mock document client
const mockDocumentClient = {
  send: mockSend
};

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: mockDynamoDBClient
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => mockDocumentClient)
    },
    PutCommand: jest.fn().mockImplementation(function(input) {
      commandStore.lastPutCommand = { input };
      this.input = input;
      return this;
    }),
    QueryCommand: jest.fn().mockImplementation(function(input) {
      commandStore.lastQueryCommand = { input };
      this.input = input;
      return this;
    }),
    BatchWriteCommand: jest.fn().mockImplementation(function(input) {
      commandStore.lastBatchWriteCommand = { input };
      this.input = input;
      return this;
    })
  };
});

const {
  storeOutbreakData,
  batchStoreOutbreakData,
  getOutbreakData,
  getAllOutbreakDataForArea,
  TTL_DURATION_SECONDS
} = require('../src/dynamodb-storage');

describe.skip('DynamoDB Storage Module', () => {
  beforeEach(() => {
    // Reset mocks
    commandStore.lastPutCommand = null;
    commandStore.lastQueryCommand = null;
    commandStore.lastBatchWriteCommand = null;
    jest.clearAllMocks();
    mockSend.mockReset();
    
    // Setup default mock response
    mockSend.mockResolvedValue({});
  });

  describe('storeOutbreakData', () => {
    it('should store a single outbreak data record with TTL', async () => {
      const outbreakData = {
        geographicArea: 'California',
        disease: 'Influenza',
        severity: 7.5,
        metrics: {
          wastewater: 8,
          ili: 3.5,
          hospitalAdmissions: 1500,
          hospitalizationRate: 7.2
        },
        normalizedMetrics: {
          wastewater: 80,
          ili: 70,
          hospitalAdmissions: 75,
          hospitalizationRate: 72
        },
        timestamp: '2024-03-15T10:00:00Z',
        dataSource: {
          nwss: true,
          nhsn: true,
          fluview: true,
          flusurv: true,
          wastewaterscan: false
        },
        coverageLevel: 'exact',
        proximityAdjustment: 1.0
      };

      mockSend.mockResolvedValue({});

      await storeOutbreakData(outbreakData);

      expect(mockSend).toHaveBeenCalledTimes(1);
      
      // Get the PutCommand that was passed to send()
      expect(commandStore.lastPutCommand).toBeDefined();
      expect(commandStore.lastPutCommand.input).toBeDefined();
      expect(commandStore.lastPutCommand.input.TableName).toBe('outbreak-data-dev');
      expect(commandStore.lastPutCommand.input.Item.geographic_area).toBe('California');
      expect(commandStore.lastPutCommand.input.Item.disease_name).toBe('Influenza');
      expect(commandStore.lastPutCommand.input.Item.severity).toBe(7.5);
      expect(commandStore.lastPutCommand.input.Item.expiration_time).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(commandStore.lastPutCommand.input.Item.coverage_level).toBe('exact');
      expect(commandStore.lastPutCommand.input.Item.proximity_adjustment).toBe(1.0);
    });

    it('should throw error for invalid outbreak data', async () => {
      await expect(storeOutbreakData({})).rejects.toThrow('Invalid outbreak data');
      await expect(storeOutbreakData({ geographicArea: 'CA' })).rejects.toThrow('Invalid outbreak data');
      await expect(storeOutbreakData({ disease: 'Flu' })).rejects.toThrow('Invalid outbreak data');
    });

    it('should use default values for optional fields', async () => {
      const minimalData = {
        geographicArea: 'Texas',
        disease: 'RSV',
        severity: 5.0,
        metrics: {},
        normalizedMetrics: {},
        timestamp: '2024-03-15T10:00:00Z',
        dataSource: {}
      };

      mockSend.mockResolvedValue({});

      await storeOutbreakData(minimalData);

      expect(commandStore.lastPutCommand.input.Item.coverage_level).toBe('exact');
      expect(commandStore.lastPutCommand.input.Item.proximity_adjustment).toBe(1.0);
    });

    it('should calculate TTL as 10 days from now', async () => {
      const outbreakData = {
        geographicArea: 'New York',
        disease: 'COVID-19',
        severity: 6.0,
        metrics: {},
        normalizedMetrics: {},
        timestamp: '2024-03-15T10:00:00Z',
        dataSource: {}
      };

      mockSend.mockResolvedValue({});

      const beforeTime = Math.floor(Date.now() / 1000) + TTL_DURATION_SECONDS;
      await storeOutbreakData(outbreakData);
      const afterTime = Math.floor(Date.now() / 1000) + TTL_DURATION_SECONDS;

      expect(commandStore.lastPutCommand.input.Item.expiration_time).toBeGreaterThanOrEqual(beforeTime);
      expect(commandStore.lastPutCommand.input.Item.expiration_time).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('batchStoreOutbreakData', () => {
    it('should store multiple outbreak data records in batch', async () => {
      const outbreakDataArray = [
        {
          geographicArea: 'California',
          disease: 'Influenza',
          severity: 7.5,
          metrics: {},
          normalizedMetrics: {},
          timestamp: '2024-03-15T10:00:00Z',
          dataSource: {}
        },
        {
          geographicArea: 'Texas',
          disease: 'RSV',
          severity: 6.0,
          metrics: {},
          normalizedMetrics: {},
          timestamp: '2024-03-15T10:00:00Z',
          dataSource: {}
        }
      ];

      mockSend.mockResolvedValue({ UnprocessedItems: {} });

      const result = await batchStoreOutbreakData(outbreakDataArray);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);

      expect(commandStore.lastBatchWriteCommand.input.RequestItems['outbreak-data-dev']).toHaveLength(2);
    });

    it('should handle batches larger than 25 items', async () => {
      const outbreakDataArray = Array.from({ length: 30 }, (_, i) => ({
        geographicArea: 'State' + i,
        disease: 'Disease' + i,
        severity: 5.0,
        metrics: {},
        normalizedMetrics: {},
        timestamp: '2024-03-15T10:00:00Z',
        dataSource: {}
      }));

      mockSend.mockResolvedValue({ UnprocessedItems: {} });

      const result = await batchStoreOutbreakData(outbreakDataArray);

      // Should be called twice: 25 items + 5 items
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(30);
      expect(result.failureCount).toBe(0);
    });

    it('should handle unprocessed items', async () => {
      const outbreakDataArray = [
        {
          geographicArea: 'California',
          disease: 'Influenza',
          severity: 7.5,
          metrics: {},
          normalizedMetrics: {},
          timestamp: '2024-03-15T10:00:00Z',
          dataSource: {}
        }
      ];

      mockSend.mockResolvedValue({
        UnprocessedItems: {
          'outbreak-data-dev': [{ PutRequest: {} }]
        }
      });

      const result = await batchStoreOutbreakData(outbreakDataArray);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
    });

    it('should return zero counts for empty array', async () => {
      const result = await batchStoreOutbreakData([]);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle batch write errors gracefully', async () => {
      const outbreakDataArray = [
        {
          geographicArea: 'California',
          disease: 'Influenza',
          severity: 7.5,
          metrics: {},
          normalizedMetrics: {},
          timestamp: '2024-03-15T10:00:00Z',
          dataSource: {}
        }
      ];

      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await batchStoreOutbreakData(outbreakDataArray);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
    });
  });

  describe('getOutbreakData', () => {
    it('should retrieve outbreak data for specific area and disease', async () => {
      const mockItems = [
        {
          geographic_area: 'California',
          disease_id: 'Influenza_1710504000000',
          disease_name: 'Influenza',
          severity: 7.5,
          last_updated: '2024-03-15T10:00:00Z'
        }
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await getOutbreakData('California', 'Influenza');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockItems);

      expect(commandStore.lastQueryCommand.input.KeyConditionExpression).toContain('geographic_area = :area');
      expect(commandStore.lastQueryCommand.input.ExpressionAttributeValues[':area']).toBe('California');
      expect(commandStore.lastQueryCommand.input.ExpressionAttributeValues[':disease']).toBe('Influenza');
    });

    it('should return empty array when no data found', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await getOutbreakData('Alaska', 'Measles');

      expect(result).toEqual([]);
    });

    it('should throw error for missing parameters', async () => {
      await expect(getOutbreakData('', 'Flu')).rejects.toThrow('geographicArea and disease are required');
      await expect(getOutbreakData('CA', '')).rejects.toThrow('geographicArea and disease are required');
    });

    it('should limit results to 10 most recent records', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await getOutbreakData('California', 'Influenza');

      expect(commandStore.lastQueryCommand.input.Limit).toBe(10);
      expect(commandStore.lastQueryCommand.input.ScanIndexForward).toBe(false); // Descending order
    });
  });

  describe('getAllOutbreakDataForArea', () => {
    it('should retrieve all outbreak data for a geographic area', async () => {
      const mockItems = [
        {
          geographic_area: 'California',
          disease_id: 'Influenza_1710504000000',
          disease_name: 'Influenza',
          severity: 7.5
        },
        {
          geographic_area: 'California',
          disease_id: 'RSV_1710504000000',
          disease_name: 'RSV',
          severity: 6.0
        }
      ];

      mockSend.mockResolvedValue({ Items: mockItems });

      const result = await getAllOutbreakDataForArea('California');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockItems);

      expect(commandStore.lastQueryCommand.input.KeyConditionExpression).toBe('geographic_area = :area');
      expect(commandStore.lastQueryCommand.input.ExpressionAttributeValues[':area']).toBe('California');
    });

    it('should throw error for missing geographic area', async () => {
      await expect(getAllOutbreakDataForArea('')).rejects.toThrow('geographicArea is required');
    });
  });

  describe('TTL Configuration', () => {
    it('should have TTL duration of 10 days (864000 seconds)', () => {
      expect(TTL_DURATION_SECONDS).toBe(10 * 24 * 60 * 60);
      expect(TTL_DURATION_SECONDS).toBe(864000);
    });
  });
});
