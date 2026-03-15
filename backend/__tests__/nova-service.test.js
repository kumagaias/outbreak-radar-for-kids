/**
 * Unit tests for NovaService
 */

const NovaService = require('../lib/nova-service');

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime');

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

describe('NovaService', () => {
  let novaService;
  let mockSend;

  beforeEach(() => {
    mockSend = jest.fn();
    BedrockRuntimeClient.mockImplementation(() => ({
      send: mockSend
    }));

    novaService = new NovaService('test-guardrail-id', 'DRAFT', 'us-east-1');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('selectNovaModel', () => {
    it('should select Micro for low risk', () => {
      const model = novaService.selectNovaModel('low', []);
      expect(model).toBe('amazon.nova-micro-v1:0');
    });

    it('should select Micro for medium risk', () => {
      const model = novaService.selectNovaModel('medium', []);
      expect(model).toBe('amazon.nova-micro-v1:0');
    });

    it('should select Micro for high risk with single disease', () => {
      const outbreakData = [{ severity: 8 }];
      const model = novaService.selectNovaModel('high', outbreakData);
      expect(model).toBe('amazon.nova-micro-v1:0');
    });

    it('should select Lite for high risk with multiple high-severity diseases', () => {
      const outbreakData = [
        { severity: 8 },
        { severity: 9 }
      ];
      const model = novaService.selectNovaModel('high', outbreakData);
      expect(model).toBe('amazon.nova-lite-v1:0');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build Japanese prompt', async () => {
      const promptObject = await novaService.buildSystemPrompt(
        'ja',
        '2-3',
        'Tokyo, JP',
        ['RSV', 'Influenza'],
        'high'
      );

      expect(promptObject.content).toContain('保育アドバイザー');
      expect(promptObject.content).toContain('です・ます調');
      expect(promptObject.content).toContain('Tokyo');
      expect(promptObject.content).toContain('RSV');
      expect(promptObject.version).toBe('fallback'); // In test environment, Parameter Store is not available
    });

    it('should build English prompt', async () => {
      const promptObject = await novaService.buildSystemPrompt(
        'en',
        '2-3',
        'California, US',
        ['RSV', 'Influenza'],
        'high'
      );

      expect(promptObject.content).toContain('childcare advisor');
      expect(promptObject.content).toContain('declarative sentences');
      expect(promptObject.content).toContain('California');
      expect(promptObject.content).toContain('RSV');
      expect(promptObject.version).toBe('fallback');
    });

    it('should include context variables', async () => {
      const promptObject = await novaService.buildSystemPrompt(
        'en',
        '4-6',
        'Tokyo, JP',
        ['RSV'],
        'medium'
      );

      expect(promptObject.content).toContain('4-6');
      expect(promptObject.content).toContain('Tokyo');
      expect(promptObject.content).toContain('RSV');
      expect(promptObject.content).toContain('medium');
    });
  });

  describe('generateRecommendation', () => {
    it('should generate recommendation successfully', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          output: {
            message: {
              content: [{
                text: JSON.stringify({
                  summary: 'Test summary',
                  actionItems: ['Action 1', 'Action 2', 'Action 3']
                })
              }]
            }
          }
        }))
      };

      mockSend.mockResolvedValue(mockResponse);

      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja',
        diseaseNames: ['RSV'],
        outbreakData: [{ diseaseName: 'RSV', severity: 8 }]
      };

      const result = await novaService.generateRecommendation(request);

      expect(result.summary).toBe('Test summary');
      expect(result.actionItems).toHaveLength(3);
      expect(result.source).toMatch(/nova-(lite|micro)/);
      expect(result.riskLevel).toBe('high');
    });

    it('should return fallback on timeout', async () => {
      // Mock a timeout by rejecting with timeout error
      mockSend.mockRejectedValue(new Error('Nova service timeout after 5s'));

      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja',
        diseaseNames: ['RSV'],
        outbreakData: []
      };

      const result = await novaService.generateRecommendation(request);

      expect(result.source).toBe('fallback');
      expect(result.summary).toBeDefined();
      expect(result.actionItems).toBeDefined();
    });

    it('should return fallback on error', async () => {
      mockSend.mockRejectedValue(new Error('Bedrock error'));

      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja',
        diseaseNames: ['RSV'],
        outbreakData: []
      };

      const result = await novaService.generateRecommendation(request);

      expect(result.source).toBe('fallback');
    });

    it('should return fallback on Guardrail intervention', async () => {
      const error = new Error('Guardrail blocked');
      error.name = 'GuardrailInterventionException';
      mockSend.mockRejectedValue(error);

      const request = {
        ageRange: '2-3',
        geographicArea: 'Tokyo, JP',
        riskLevel: 'high',
        language: 'ja',
        diseaseNames: ['RSV'],
        outbreakData: []
      };

      const result = await novaService.generateRecommendation(request);

      expect(result.source).toBe('fallback');
    });
  });

  describe('parseNovaResponse', () => {
    it('should parse valid JSON response', () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          output: {
            message: {
              content: [{
                text: JSON.stringify({
                  summary: 'Test summary',
                  actionItems: ['Action 1', 'Action 2', 'Action 3']
                })
              }]
            }
          }
        }))
      };

      const result = novaService.parseNovaResponse(mockResponse, 'amazon.nova-micro-v1:0', 1000);

      expect(result.summary).toBe('Test summary');
      expect(result.actionItems).toHaveLength(3);
      expect(result.source).toBe('nova-micro');
      expect(result.modelLatencyMs).toBe(1000);
    });

    it('should strip markdown code blocks', () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          output: {
            message: {
              content: [{
                text: '```json\n{"summary": "Test", "actionItems": ["A1", "A2", "A3"]}\n```'
              }]
            }
          }
        }))
      };

      const result = novaService.parseNovaResponse(mockResponse, 'amazon.nova-micro-v1:0', 1000);

      expect(result.summary).toBe('Test');
      expect(result.actionItems).toHaveLength(3);
    });

    it('should throw on missing required fields', () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          output: {
            message: {
              content: [{
                text: JSON.stringify({ summary: 'Test' }) // Missing actionItems
              }]
            }
          }
        }))
      };

      expect(() => {
        novaService.parseNovaResponse(mockResponse, 'amazon.nova-micro-v1:0', 1000);
      }).toThrow('Missing required fields');
    });
  });
});
