/**
 * Unit tests for e-Stat API data fetcher
 */

const estat = require('../src/sources/estat');

// Mock https module
jest.mock('https');
const https = require('https');

// Mock AWS SDK Secrets Manager
jest.mock('@aws-sdk/client-secrets-manager');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

describe('e-Stat Data Fetcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Secrets Manager client
    const mockSend = jest.fn().mockResolvedValue({
      SecretString: JSON.stringify({ appId: 'test-app-id-12345' })
    });
    
    SecretsManagerClient.mockImplementation(() => ({
      send: mockSend
    }));
  });
  
  describe('getEStatAPIKey', () => {
    it('should retrieve API key from Secrets Manager', async () => {
      const apiKey = await estat.getEStatAPIKey();
      
      expect(apiKey).toBe('test-app-id-12345');
      expect(SecretsManagerClient).toHaveBeenCalledWith({ region: expect.any(String) });
    });
    
    it('should handle apiKey field name', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ apiKey: 'test-key-67890' })
      });
      
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));
      
      const apiKey = await estat.getEStatAPIKey();
      
      expect(apiKey).toBe('test-key-67890');
    });
    
    it('should handle api_key field name', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ api_key: 'test-key-underscore' })
      });
      
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));
      
      const apiKey = await estat.getEStatAPIKey();
      
      expect(apiKey).toBe('test-key-underscore');
    });
    
    it('should throw error when secret does not contain valid field', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ invalidField: 'value' })
      });
      
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));
      
      await expect(estat.getEStatAPIKey())
        .rejects.toThrow('Secret does not contain appId, apiKey, or api_key field');
    });
    
    it('should handle Secrets Manager errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Access denied'));
      
      SecretsManagerClient.mockImplementation(() => ({
        send: mockSend
      }));
      
      await expect(estat.getEStatAPIKey())
        .rejects.toThrow('e-Stat API key retrieval failed');
    });
  });
  
  describe('fetchEStatData', () => {
    it('should throw error when statsDataId is missing', async () => {
      await expect(estat.fetchEStatData({}))
        .rejects.toThrow('statsDataId parameter is required');
    });
    
    it('should fetch data with correct URL format', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: []
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      await estat.fetchEStatData({ statsDataId: 'TEST123' });
      
      const callArgs = https.get.mock.calls[0];
      const url = callArgs[0];
      expect(url).toContain('api.e-stat.go.jp');
      expect(url).toContain('statsDataId=TEST123');
      expect(url).toContain('appId=test-app-id-12345');
    });
    
    it('should include optional parameters in URL', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: []
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      await estat.fetchEStatData({
        statsDataId: 'TEST123',
        cdCat01: 'CAT001',
        cdArea: 'AREA13',
        limit: 5000
      });
      
      const callArgs = https.get.mock.calls[0];
      const url = callArgs[0];
      expect(url).toContain('cdCat01=CAT001');
      expect(url).toContain('cdArea=AREA13');
      expect(url).toContain('limit=5000');
    });
    
    it('should handle HTTP errors', async () => {
      mockHTTPSError(new Error('Network error'));
      
      await expect(estat.fetchEStatData({ statsDataId: 'TEST123' }))
        .rejects.toThrow('e-Stat API request failed');
    });
    
    it('should handle non-200 status codes', async () => {
      mockHTTPSStatusCode(404, 'Not Found');
      
      await expect(estat.fetchEStatData({ statsDataId: 'TEST123' }))
        .rejects.toThrow('e-Stat API returned status 404');
    });
    
    it('should handle timeout', async () => {
      mockHTTPSTimeout();
      
      await expect(estat.fetchEStatData({ statsDataId: 'TEST123' }))
        .rejects.toThrow('e-Stat API request timeout');
    });
    
    it('should handle API error responses', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: {
            STATUS: 1,
            ERROR_MSG: 'Invalid parameter'
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      await expect(estat.fetchEStatData({ statsDataId: 'TEST123' }))
        .rejects.toThrow('e-Stat API error: Invalid parameter');
    });
    
    it('should handle JSON parse errors', async () => {
      mockHTTPSRequest('invalid json {');
      
      await expect(estat.fetchEStatData({ statsDataId: 'TEST123' }))
        .rejects.toThrow('Failed to parse e-Stat API response');
    });
  });
  
  describe('buildCategoryMap', () => {
    it('should build map from single class object', () => {
      const classObj = {
        '@id': '@cat01',
        CLASS: [
          { '@code': '001', '@name': '感染性胃腸炎' },
          { '@code': '002', '@name': 'インフルエンザ' }
        ]
      };
      
      const map = estat.buildCategoryMap(classObj, '@cat01');
      
      expect(map['001']).toBe('感染性胃腸炎');
      expect(map['002']).toBe('インフルエンザ');
    });
    
    it('should build map from array of class objects', () => {
      const classObj = [
        {
          '@id': '@cat01',
          CLASS: [
            { '@code': '001', '@name': '感染性胃腸炎' }
          ]
        },
        {
          '@id': '@area',
          CLASS: [
            { '@code': '13', '@name': '東京都' }
          ]
        }
      ];
      
      const map = estat.buildCategoryMap(classObj, '@area');
      
      expect(map['13']).toBe('東京都');
    });
    
    it('should handle single CLASS item (not array)', () => {
      const classObj = {
        '@id': '@cat01',
        CLASS: { '@code': '001', '@name': '感染性胃腸炎' }
      };
      
      const map = estat.buildCategoryMap(classObj, '@cat01');
      
      expect(map['001']).toBe('感染性胃腸炎');
    });
    
    it('should return empty map for null input', () => {
      const map = estat.buildCategoryMap(null, '@cat01');
      
      expect(map).toEqual({});
    });
    
    it('should return empty map when class ID not found', () => {
      const classObj = {
        '@id': '@cat01',
        CLASS: [
          { '@code': '001', '@name': '感染性胃腸炎' }
        ]
      };
      
      const map = estat.buildCategoryMap(classObj, '@area');
      
      expect(map).toEqual({});
    });
    
    it('should return empty map when CLASS is missing', () => {
      const classObj = {
        '@id': '@cat01'
      };
      
      const map = estat.buildCategoryMap(classObj, '@cat01');
      
      expect(map).toEqual({});
    });
  });
  
  describe('parseEStatResponse', () => {
    it('should parse valid API response', () => {
      const apiResponse = {
        GET_STATS_DATA: {
          STATISTICAL_DATA: {
            DATA_INF: {
              CLASS_INF: {
                CLASS_OBJ: [
                  {
                    '@id': '@cat01',
                    CLASS: [
                      { '@code': '001', '@name': '感染性胃腸炎' }
                    ]
                  },
                  {
                    '@id': '@area',
                    CLASS: [
                      { '@code': '13', '@name': '東京都' }
                    ]
                  },
                  {
                    '@id': '@time',
                    CLASS: [
                      { '@code': '202410', '@name': '2024年第10週' }
                    ]
                  }
                ]
              },
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                }
              ]
            }
          }
        }
      };
      
      const records = estat.parseEStatResponse(apiResponse);
      
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        diseaseCode: '001',
        diseaseName: '感染性胃腸炎',
        areaCode: '13',
        areaName: '東京都',
        timeCode: '202410',
        timePeriod: '2024年第10週',
        value: '150'
      });
    });
    
    it('should return empty array for null input', () => {
      const records = estat.parseEStatResponse(null);
      expect(records).toEqual([]);
    });
    
    it('should return empty array when GET_STATS_DATA is missing', () => {
      const apiResponse = {};
      const records = estat.parseEStatResponse(apiResponse);
      expect(records).toEqual([]);
    });
    
    it('should return empty array when STATISTICAL_DATA is missing', () => {
      const apiResponse = {
        GET_STATS_DATA: {}
      };
      const records = estat.parseEStatResponse(apiResponse);
      expect(records).toEqual([]);
    });
    
    it('should return empty array when VALUE is empty', () => {
      const apiResponse = {
        GET_STATS_DATA: {
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: []
            }
          }
        }
      };
      const records = estat.parseEStatResponse(apiResponse);
      expect(records).toEqual([]);
    });
    
    it('should handle missing category mappings', () => {
      const apiResponse = {
        GET_STATS_DATA: {
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: [
                {
                  '@cat01': '999',
                  '@area': '99',
                  '@time': '202410',
                  '$': '100'
                }
              ]
            }
          }
        }
      };
      
      const records = estat.parseEStatResponse(apiResponse);
      
      expect(records).toHaveLength(1);
      expect(records[0].diseaseName).toBe('999');
      expect(records[0].areaName).toBe('99');
    });
    
    it('should continue parsing after encountering error in a record', () => {
      const apiResponse = {
        GET_STATS_DATA: {
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                },
                null,  // Invalid record
                {
                  '@cat01': '002',
                  '@area': '27',
                  '@time': '202411',
                  '$': '200'
                }
              ]
            }
          }
        }
      };
      
      const records = estat.parseEStatResponse(apiResponse);
      
      // Should parse valid records and skip invalid ones
      expect(records.length).toBeGreaterThan(0);
    });
  });
  
  describe('normalizeEStatRecord', () => {
    it('should normalize record with standard fields', () => {
      const record = {
        diseaseName: '感染性胃腸炎',
        areaName: '東京都',
        timeCode: '202410',
        value: '150'
      };
      
      const result = estat.normalizeEStatRecord(record);
      
      expect(result).toMatchObject({
        disease: 'Norovirus',
        diseaseJa: '感染性胃腸炎',
        prefecture: 'Tokyo',
        prefectureJa: '東京都',
        weekNumber: 10,
        year: 2024,
        caseCount: 150,
        per100kPopulation: null,
        timestamp: expect.any(String)
      });
    });
    
    it('should map all Japanese prefectures to English', () => {
      const testCases = [
        { ja: '北海道', en: 'Hokkaido' },
        { ja: '東京都', en: 'Tokyo' },
        { ja: '大阪府', en: 'Osaka' },
        { ja: '京都府', en: 'Kyoto' },
        { ja: '沖縄県', en: 'Okinawa' }
      ];
      
      testCases.forEach(({ ja, en }) => {
        const record = {
          diseaseName: '感染性胃腸炎',
          areaName: ja,
          timeCode: '202410',
          value: '100'
        };
        
        const result = estat.normalizeEStatRecord(record);
        
        expect(result.prefecture).toBe(en);
        expect(result.prefectureJa).toBe(ja);
      });
    });
    
    it('should preserve unmapped prefecture names', () => {
      const record = {
        diseaseName: '感染性胃腸炎',
        areaName: '全国',
        timeCode: '202410',
        value: '1000'
      };
      
      const result = estat.normalizeEStatRecord(record);
      
      expect(result.prefecture).toBe('全国');
      expect(result.prefectureJa).toBe('全国');
    });
    
    it('should parse time code correctly', () => {
      const testCases = [
        { timeCode: '202401', expectedYear: 2024, expectedWeek: 1 },
        { timeCode: '202410', expectedYear: 2024, expectedWeek: 10 },
        { timeCode: '202452', expectedYear: 2024, expectedWeek: 52 }
      ];
      
      testCases.forEach(({ timeCode, expectedYear, expectedWeek }) => {
        const record = {
          diseaseName: '感染性胃腸炎',
          areaName: '東京都',
          timeCode: timeCode,
          value: '100'
        };
        
        const result = estat.normalizeEStatRecord(record);
        
        expect(result.year).toBe(expectedYear);
        expect(result.weekNumber).toBe(expectedWeek);
      });
    });
    
    it('should handle missing time code', () => {
      const record = {
        diseaseName: '感染性胃腸炎',
        areaName: '東京都',
        value: '100'
      };
      
      const result = estat.normalizeEStatRecord(record);
      
      expect(result.year).toBeNull();
      expect(result.weekNumber).toBeNull();
    });
    
    it('should return null for null input', () => {
      const result = estat.normalizeEStatRecord(null);
      expect(result).toBeNull();
    });
    
    it('should return null when disease name is missing', () => {
      const record = {
        areaName: '東京都',
        timeCode: '202410',
        value: '100'
      };
      
      const result = estat.normalizeEStatRecord(record);
      expect(result).toBeNull();
    });
    
    it('should handle non-numeric case count', () => {
      const record = {
        diseaseName: '感染性胃腸炎',
        areaName: '東京都',
        timeCode: '202410',
        value: 'invalid'
      };
      
      const result = estat.normalizeEStatRecord(record);
      
      expect(result.caseCount).toBe(0);
    });
    
    it('should handle missing case count', () => {
      const record = {
        diseaseName: '感染性胃腸炎',
        areaName: '東京都',
        timeCode: '202410'
      };
      
      const result = estat.normalizeEStatRecord(record);
      
      expect(result.caseCount).toBe(0);
    });
    
    it('should preserve unmapped disease names', () => {
      const record = {
        diseaseName: '未知の疾患',
        areaName: '東京都',
        timeCode: '202410',
        value: '50'
      };
      
      const result = estat.normalizeEStatRecord(record);
      
      expect(result.disease).toBe('未知の疾患');
      expect(result.diseaseJa).toBe('未知の疾患');
    });
  });
  
  describe('fetchNorovirusData', () => {
    it('should throw error when statsDataId is missing', async () => {
      await expect(estat.fetchNorovirusData({}))
        .rejects.toThrow('statsDataId parameter is required');
    });
    
    it('should fetch and normalize norovirus data', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              CLASS_INF: {
                CLASS_OBJ: [
                  {
                    '@id': '@cat01',
                    CLASS: [
                      { '@code': '001', '@name': '感染性胃腸炎' }
                    ]
                  },
                  {
                    '@id': '@area',
                    CLASS: [
                      { '@code': '13', '@name': '東京都' }
                    ]
                  },
                  {
                    '@id': '@time',
                    CLASS: [
                      { '@code': '202410', '@name': '2024年第10週' }
                    ]
                  }
                ]
              },
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                }
              ]
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      const result = await estat.fetchNorovirusData({ statsDataId: 'TEST123' });
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        disease: 'Norovirus',
        diseaseJa: '感染性胃腸炎',
        prefecture: 'Tokyo',
        prefectureJa: '東京都',
        weekNumber: 10,
        year: 2024,
        caseCount: 150
      });
    });
    
    it('should filter by prefecture', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              CLASS_INF: {
                CLASS_OBJ: [
                  {
                    '@id': '@area',
                    CLASS: [
                      { '@code': '13', '@name': '東京都' },
                      { '@code': '27', '@name': '大阪府' }
                    ]
                  }
                ]
              },
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                },
                {
                  '@cat01': '001',
                  '@area': '27',
                  '@time': '202410',
                  '$': '200'
                }
              ]
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      const result = await estat.fetchNorovirusData({
        statsDataId: 'TEST123',
        prefecture: '東京都'
      });
      
      // Should only return Tokyo data
      expect(result.length).toBeGreaterThan(0);
      result.forEach(record => {
        expect(record.prefectureJa).toBe('東京都');
      });
    });
    
    it('should filter by year', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                },
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202310',
                  '$': '100'
                }
              ]
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      const result = await estat.fetchNorovirusData({
        statsDataId: 'TEST123',
        year: 2024
      });
      
      // Should only return 2024 data
      result.forEach(record => {
        expect(record.year).toBe(2024);
      });
    });
    
    it('should filter by week', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                },
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202411',
                  '$': '160'
                }
              ]
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      const result = await estat.fetchNorovirusData({
        statsDataId: 'TEST123',
        week: 10
      });
      
      // Should only return week 10 data
      result.forEach(record => {
        expect(record.weekNumber).toBe(10);
      });
    });
    
    it('should filter out null records', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: [
                {
                  '@cat01': '001',
                  '@area': '13',
                  '@time': '202410',
                  '$': '150'
                },
                {
                  // Missing disease name - will be filtered out
                  '@area': '27',
                  '@time': '202410',
                  '$': '200'
                }
              ]
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      const result = await estat.fetchNorovirusData({ statsDataId: 'TEST123' });
      
      // Should only return valid records
      expect(result.every(r => r !== null)).toBe(true);
    });
    
    it('should handle empty response', async () => {
      const mockResponse = {
        GET_STATS_DATA: {
          RESULT: { STATUS: 0 },
          STATISTICAL_DATA: {
            DATA_INF: {
              VALUE: []
            }
          }
        }
      };
      
      mockHTTPSRequest(JSON.stringify(mockResponse));
      
      const result = await estat.fetchNorovirusData({ statsDataId: 'TEST123' });
      
      expect(result).toEqual([]);
    });
    
    it('should propagate fetch errors', async () => {
      mockHTTPSError(new Error('Network error'));
      
      await expect(estat.fetchNorovirusData({ statsDataId: 'TEST123' }))
        .rejects.toThrow('e-Stat API request failed');
    });
  });
  
  describe('DISEASE_MAPPING', () => {
    it('should include norovirus mapping', () => {
      const mapping = estat.DISEASE_MAPPING;
      
      expect(mapping['感染性胃腸炎']).toBe('Norovirus');
    });
  });
  
  describe('PREFECTURE_MAPPING', () => {
    it('should include all 47 prefectures', () => {
      const mapping = estat.PREFECTURE_MAPPING;
      
      // Check a few key prefectures
      expect(mapping['北海道']).toBe('Hokkaido');
      expect(mapping['東京都']).toBe('Tokyo');
      expect(mapping['大阪府']).toBe('Osaka');
      expect(mapping['沖縄県']).toBe('Okinawa');
      
      // Count total prefectures (should be 47)
      expect(Object.keys(mapping).length).toBe(47);
    });
  });
});

// Helper functions for mocking HTTPS requests

function mockHTTPSRequest(responseData) {
  const mockResponse = {
    statusCode: 200,
    on: jest.fn((event, handler) => {
      if (event === 'data') {
        handler(responseData);
      } else if (event === 'end') {
        handler();
      }
      return mockResponse;
    })
  };
  
  const mockRequest = {
    on: jest.fn((event, handler) => {
      return mockRequest;
    }),
    setTimeout: jest.fn((timeout, callback) => {
      return mockRequest;
    }),
    destroy: jest.fn()
  };
  
  https.get.mockImplementation((url, callback) => {
    if (typeof callback === 'function') {
      callback(mockResponse);
    }
    return mockRequest;
  });
}

function mockHTTPSError(error) {
  const mockRequest = {
    on: jest.fn((event, handler) => {
      if (event === 'error') {
        handler(error);
      }
      return mockRequest;
    }),
    setTimeout: jest.fn((timeout, callback) => {
      return mockRequest;
    }),
    destroy: jest.fn()
  };
  
  https.get.mockImplementation(() => mockRequest);
}

function mockHTTPSStatusCode(statusCode, statusMessage) {
  const mockResponse = {
    statusCode,
    statusMessage,
    on: jest.fn((event, handler) => {
      if (event === 'end') {
        handler();
      }
      return mockResponse;
    })
  };
  
  const mockRequest = {
    on: jest.fn((event, handler) => {
      return mockRequest;
    }),
    setTimeout: jest.fn((timeout, callback) => {
      return mockRequest;
    }),
    destroy: jest.fn()
  };
  
  https.get.mockImplementation((url, callback) => {
    if (typeof callback === 'function') {
      callback(mockResponse);
    }
    return mockRequest;
  });
}

function mockHTTPSTimeout() {
  const mockRequest = {
    on: jest.fn((event, handler) => {
      return mockRequest;
    }),
    setTimeout: jest.fn((timeout, callback) => {
      // Immediately trigger timeout callback
      if (typeof callback === 'function') {
        callback();
      }
      return mockRequest;
    }),
    destroy: jest.fn()
  };
  
  https.get.mockImplementation(() => mockRequest);
}
