/**
 * Unit tests for PromptManager
 */

const PromptManager = require('../lib/prompt-manager');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

// Mock AWS SDK
jest.mock('@aws-sdk/client-ssm');

describe('PromptManager', () => {
  let promptManager;
  let mockSend;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock send function
    mockSend = jest.fn();
    SSMClient.mockImplementation(() => ({
      send: mockSend
    }));
    
    // Create PromptManager instance
    promptManager = new PromptManager('us-east-1');
  });

  describe('getPrompt', () => {
    it('should retrieve Japanese prompt from Parameter Store', async () => {
      const mockPromptContent = 'あなたは保護者に感染症に関するアドバイスを提供する...';
      mockSend.mockResolvedValue({
        Parameter: {
          Value: mockPromptContent,
          Version: 2,
          LastModifiedDate: new Date('2024-01-01')
        }
      });

      const result = await promptManager.getPrompt('ja');

      expect(result.content).toBe(mockPromptContent);
      expect(result.version).toBe(2);
      expect(result.path).toBe('/prompts/v1/ja');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should retrieve English prompt from Parameter Store', async () => {
      const mockPromptContent = 'You are a helpful childcare advisor...';
      mockSend.mockResolvedValue({
        Parameter: {
          Value: mockPromptContent,
          Version: 3,
          LastModifiedDate: new Date('2024-01-01')
        }
      });

      const result = await promptManager.getPrompt('en');

      expect(result.content).toBe(mockPromptContent);
      expect(result.version).toBe(3);
      expect(result.path).toBe('/prompts/v1/en');
    });

    it('should cache prompts after first retrieval', async () => {
      const mockPromptContent = 'Test prompt';
      mockSend.mockResolvedValue({
        Parameter: {
          Value: mockPromptContent,
          Version: 1,
          LastModifiedDate: new Date('2024-01-01')
        }
      });

      // First call - should hit Parameter Store
      await promptManager.getPrompt('ja');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await promptManager.getPrompt('ja');
      expect(mockSend).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result.content).toBe(mockPromptContent);
    });

    it('should fallback to hardcoded prompt when Parameter Store fails', async () => {
      mockSend.mockRejectedValue(new Error('Parameter not found'));

      const result = await promptManager.getPrompt('ja');

      expect(result.version).toBe('fallback');
      expect(result.path).toBe('hardcoded');
      expect(result.content).toContain('保護者に感染症に関するアドバイス');
    });

    it('should use environment variables for parameter paths', async () => {
      // Save original values
      const originalJaPath = process.env.PROMPT_JA_PATH;
      const originalEnPath = process.env.PROMPT_EN_PATH;
      
      process.env.PROMPT_JA_PATH = '/custom/prompts/ja';
      process.env.PROMPT_EN_PATH = '/custom/prompts/en';
      
      const customPromptManager = new PromptManager('us-east-1');
      
      mockSend.mockResolvedValue({
        Parameter: {
          Value: 'Custom prompt',
          Version: 1,
          LastModifiedDate: new Date('2024-01-01')
        }
      });

      const result = await customPromptManager.getPrompt('ja');

      expect(result.path).toBe('/custom/prompts/ja');
      expect(mockSend).toHaveBeenCalled();

      // Restore original values
      if (originalJaPath) {
        process.env.PROMPT_JA_PATH = originalJaPath;
      } else {
        delete process.env.PROMPT_JA_PATH;
      }
      if (originalEnPath) {
        process.env.PROMPT_EN_PATH = originalEnPath;
      } else {
        delete process.env.PROMPT_EN_PATH;
      }
    });
  });

  describe('buildSystemPrompt', () => {
    beforeEach(() => {
      // Clear environment variables to ensure clean state
      delete process.env.PROMPT_JA_PATH;
      delete process.env.PROMPT_EN_PATH;
      
      // Recreate promptManager with clean state
      promptManager = new PromptManager('us-east-1');
      
      const mockPromptContent = `Test prompt
Context:
- Age range: {ageRange}
- Geographic area: {geographicArea}
- Current outbreaks: {diseaseNames}
- Risk level: {riskLevel}`;

      mockSend.mockResolvedValue({
        Parameter: {
          Value: mockPromptContent,
          Version: 1,
          LastModifiedDate: new Date('2024-01-01')
        }
      });
    });

    it('should replace placeholders with actual values', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '2-3',
        'Tokyo, Japan',
        ['RSV', 'Influenza'],
        'high'
      );

      expect(result.content).toContain('Age range: 2-3');
      expect(result.content).toContain('Geographic area: Tokyo');
      expect(result.content).toContain('Current outbreaks: RSV, Influenza');
      expect(result.content).toContain('Risk level: high');
    });

    it('should use Japanese separator for disease names', async () => {
      const result = await promptManager.buildSystemPrompt(
        'ja',
        '0-1',
        'Tokyo, Japan',
        ['RSV', 'インフルエンザ', 'ノロウイルス'],
        'medium'
      );

      expect(result.content).toContain('RSV、インフルエンザ、ノロウイルス');
    });

    it('should use English separator for disease names', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '4-6',
        'California, USA',
        ['RSV', 'Influenza', 'Norovirus'],
        'low'
      );

      expect(result.content).toContain('RSV, Influenza, Norovirus');
    });

    it('should extract only first part of geographic area', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '7+',
        'Los Angeles County, California, USA',
        ['COVID-19'],
        'medium'
      );

      expect(result.content).toContain('Geographic area: Los Angeles County');
      expect(result.content).not.toContain('California, USA');
    });

    it('should include prompt version in result', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '2-3',
        'Tokyo, Japan',
        ['RSV'],
        'high'
      );

      expect(result.version).toBe(1);
      expect(result.path).toBe('/prompts/v1/en');
    });

    it('should enhance prompt when nearbyHotspot is true (Japanese)', async () => {
      const result = await promptManager.buildSystemPrompt(
        'ja',
        '2-3',
        'Tokyo, Japan',
        ['RSV'],
        'high',
        true // nearbyHotspot = true
      );

      expect(result.content).toContain('重要: ユーザーは感染症の流行地域の近くにいます');
      expect(result.content).toContain('より慎重な観察と予防措置を強調してください');
      expect(result.content).toContain('都道府県レベルのみを使用');
    });

    it('should enhance prompt when nearbyHotspot is true (English)', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '4-6',
        'California, USA',
        ['Influenza'],
        'high',
        true // nearbyHotspot = true
      );

      expect(result.content).toContain('IMPORTANT: The user is near an outbreak hotspot');
      expect(result.content).toContain('Emphasize heightened vigilance and preventive measures');
      expect(result.content).toContain('maintain prefecture/state-level anonymity');
    });

    it('should not enhance prompt when nearbyHotspot is false', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '2-3',
        'Tokyo, Japan',
        ['RSV'],
        'high',
        false // nearbyHotspot = false
      );

      expect(result.content).not.toContain('near an outbreak hotspot');
      expect(result.content).not.toContain('heightened vigilance');
    });

    it('should not enhance prompt when nearbyHotspot is undefined (default)', async () => {
      const result = await promptManager.buildSystemPrompt(
        'en',
        '2-3',
        'Tokyo, Japan',
        ['RSV'],
        'high'
        // nearbyHotspot not provided - should default to false
      );

      expect(result.content).not.toContain('near an outbreak hotspot');
      expect(result.content).not.toContain('heightened vigilance');
    });
  });

  describe('getFallbackPrompt', () => {
    it('should return Japanese fallback prompt', () => {
      const result = promptManager.getFallbackPrompt('ja');

      expect(result.version).toBe('fallback');
      expect(result.path).toBe('hardcoded');
      expect(result.content).toContain('保護者に感染症に関するアドバイス');
      expect(result.content).toContain('{ageRange}');
      expect(result.content).toContain('{geographicArea}');
      expect(result.content).toContain('{diseaseNames}');
      expect(result.content).toContain('{riskLevel}');
    });

    it('should return English fallback prompt', () => {
      const result = promptManager.getFallbackPrompt('en');

      expect(result.version).toBe('fallback');
      expect(result.path).toBe('hardcoded');
      expect(result.content).toContain('helpful childcare advisor');
      expect(result.content).toContain('{ageRange}');
      expect(result.content).toContain('{geographicArea}');
      expect(result.content).toContain('{diseaseNames}');
      expect(result.content).toContain('{riskLevel}');
    });

    it('should default to English for unknown language', () => {
      const result = promptManager.getFallbackPrompt('fr');

      expect(result.content).toContain('helpful childcare advisor');
    });
  });

  describe('clearCache', () => {
    it('should clear the prompt cache', async () => {
      const mockPromptContent = 'Test prompt';
      mockSend.mockResolvedValue({
        Parameter: {
          Value: mockPromptContent,
          Version: 1,
          LastModifiedDate: new Date('2024-01-01')
        }
      });

      // First call - should hit Parameter Store
      await promptManager.getPrompt('ja');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Clear cache
      promptManager.clearCache();

      // Second call - should hit Parameter Store again
      await promptManager.getPrompt('ja');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('should handle missing Parameter value', async () => {
      mockSend.mockResolvedValue({
        Parameter: {}
      });

      const result = await promptManager.getPrompt('ja');

      expect(result.version).toBe('fallback');
      expect(result.path).toBe('hardcoded');
    });

    it('should handle SSM client errors gracefully', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const result = await promptManager.getPrompt('en');

      expect(result.version).toBe('fallback');
      expect(result.content).toContain('helpful childcare advisor');
    });
  });
});
