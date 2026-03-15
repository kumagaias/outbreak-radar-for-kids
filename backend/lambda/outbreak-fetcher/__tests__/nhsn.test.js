const { fetchNHSNData, parseNHSNRecord, fetchStateData } = require('../src/sources/nhsn');
const https = require('https');

jest.mock('https');

describe('NHSN Data Fetcher', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchNHSNData', () => {
    it('should fetch data successfully', async () => {
      const mockData = [
        {
          jurisdiction: 'CA',
          weekendingdate: '2024-03-09',
          totalconfcovidadmissions: '150',
          covidadmissionsper100k: '0.38'
        }
      ];

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(mockData));
          } else if (event === 'end') {
            handler();
          }
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn(),
        destroy: jest.fn()
      };

      https.get.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await fetchNHSNData({ state: 'CA' });
      expect(result).toEqual(mockData);
      expect(https.get).toHaveBeenCalledWith(
        expect.stringContaining('jurisdiction+%3D+%27CA%27'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should include API key in headers when provided', async () => {
      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') handler('[]');
          else if (event === 'end') handler();
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn()
      };

      https.get.mockImplementation((url, options, callback) => {
        expect(options.headers['X-App-Token']).toBe('test-api-key');
        callback(mockResponse);
        return mockRequest;
      });

      await fetchNHSNData({ apiKey: 'test-api-key' });
    });

    it('should handle network errors', async () => {
      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'));
          }
        }),
        setTimeout: jest.fn()
      };

      https.get.mockReturnValue(mockRequest);

      await expect(fetchNHSNData()).rejects.toThrow('NHSN API request failed: Network error');
    });

    it('should handle timeout', async () => {
      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn((timeout, handler) => {
          handler();
        }),
        destroy: jest.fn()
      };

      https.get.mockReturnValue(mockRequest);

      await expect(fetchNHSNData()).rejects.toThrow('NHSN API request timeout');
    });

    it('should handle non-200 status codes', async () => {
      const mockResponse = {
        statusCode: 500,
        on: jest.fn((event, handler) => {
          if (event === 'data') handler('Error');
          else if (event === 'end') handler();
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn()
      };

      https.get.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      await expect(fetchNHSNData()).rejects.toThrow('NHSN API returned status 500');
    });
  });

  describe('parseNHSNRecord', () => {
    it('should parse COVID-19 admission record', () => {
      const record = {
        jurisdiction: 'CA',
        weekendingdate: '2024-03-09',
        totalconfcovidadmissions: '150',
        covidadmissionsper100k: '0.38',
        totalbeds: '50000',
        inpatientbeds: '45000'
      };

      const result = parseNHSNRecord(record);
      expect(result).toEqual({
        state: 'CA',
        weekEndingDate: '2024-03-09',
        diseases: [
          {
            disease: 'COVID-19',
            admissions: 150,
            admissionsPer100k: 0.38
          }
        ],
        totalBeds: 50000,
        inpatientBeds: 45000
      });
    });

    it('should parse multiple diseases in one record', () => {
      const record = {
        jurisdiction: 'NY',
        weekendingdate: '2024-03-09',
        totalconfcovidadmissions: '200',
        totalconfluadmissions: '150',
        totalconfrsvadmissions: '100'
      };

      const result = parseNHSNRecord(record);
      expect(result.diseases).toHaveLength(3);
      expect(result.diseases.map(d => d.disease)).toEqual(['COVID-19', 'Influenza', 'RSV']);
    });

    it('should return null for invalid records', () => {
      expect(parseNHSNRecord(null)).toBeNull();
      expect(parseNHSNRecord({})).toBeNull();
      expect(parseNHSNRecord({ jurisdiction: 'CA' })).toBeNull();
    });

    it('should return null when no disease data present', () => {
      const record = {
        jurisdiction: 'CA',
        weekendingdate: '2024-03-09',
        totalconfcovidadmissions: '0'
      };

      expect(parseNHSNRecord(record)).toBeNull();
    });
  });

  describe('fetchStateData', () => {
    it('should fetch and parse state data', async () => {
      const mockData = [
        {
          jurisdiction: 'CA',
          weekendingdate: '2024-03-09',
          totalconfcovidadmissions: '150'
        }
      ];

      const mockResponse = {
        statusCode: 200,
        on: jest.fn((event, handler) => {
          if (event === 'data') handler(JSON.stringify(mockData));
          else if (event === 'end') handler();
        })
      };

      const mockRequest = {
        on: jest.fn(),
        setTimeout: jest.fn()
      };

      https.get.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await fetchStateData('CA');
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('CA');
      expect(result[0].diseases[0].disease).toBe('COVID-19');
    });
  });
});
