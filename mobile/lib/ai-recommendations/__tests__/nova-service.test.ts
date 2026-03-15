/**
 * Unit tests for Nova_Service
 * Tests specific error handling scenarios
 */

import { NovaService, NovaModel } from '../nova-service';
import { NovaTimeoutError, NovaServiceError } from '../errors';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('NovaService', () => {
  let novaService: NovaService;

  beforeEach(() => {
    novaService = new NovaService('https://api.example.com/nova', 'test-api-key');
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Error Handling', () => {
    it('should throw NovaTimeoutError after 5 seconds', async () => {
      // Use real timers for this test
      jest.useRealTimers();
      
      // Mock fetch to simulate abort
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          }, 5100); // Slightly longer than timeout
        });
      });

      // Should reject with timeout error
      await expect(
        novaService.callNova(NovaModel.MICRO, 'Test prompt', 'Test input')
      ).rejects.toThrow(NovaTimeoutError);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    }, 8000); // Give Jest enough time to complete the test

    it('should throw NovaServiceError on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      });

      await expect(
        novaService.callNova(NovaModel.LITE, 'Test prompt', 'Test input')
      ).rejects.toThrow(NovaServiceError);
    });

    it('should throw NovaServiceError on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        novaService.callNova(NovaModel.MICRO, 'Test prompt', 'Test input')
      ).rejects.toThrow(NovaServiceError);
    });

    it('should throw NovaServiceError on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'Invalid JSON {'
      });

      await expect(
        novaService.callNova(NovaModel.LITE, 'Test prompt', 'Test input')
      ).rejects.toThrow(NovaServiceError);
    });

    it('should throw NovaServiceError when summary is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ actionItems: ['test'] })
      });

      await expect(
        novaService.callNova(NovaModel.MICRO, 'Test prompt', 'Test input')
      ).rejects.toThrow('Missing required fields: summary or actionItems');
    });

    it('should throw NovaServiceError when actionItems is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ summary: 'test' })
      });

      await expect(
        novaService.callNova(NovaModel.LITE, 'Test prompt', 'Test input')
      ).rejects.toThrow('Missing required fields: summary or actionItems');
    });

    it('should throw NovaServiceError when actionItems is not an array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ summary: 'test', actionItems: 'not an array' })
      });

      await expect(
        novaService.callNova(NovaModel.MICRO, 'Test prompt', 'Test input')
      ).rejects.toThrow('Missing required fields: summary or actionItems');
    });
  });

  describe('Successful Response Parsing', () => {
    it('should successfully parse valid JSON response', async () => {
      const mockResponse = {
        summary: 'RSV outbreak in Tokyo',
        actionItems: [
          'Check temperature before daycare',
          'Practice thorough handwashing',
          'Monitor for respiratory symptoms'
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockResponse)
      });

      const response = await novaService.callNova(
        NovaModel.LITE,
        'Test prompt',
        'Test input'
      );

      expect(response.summary).toBe(mockResponse.summary);
      expect(response.actionItems).toEqual(mockResponse.actionItems);
      expect(response.model).toBe(NovaModel.LITE);
      expect(typeof response.latencyMs).toBe('number');
    });

    it('should strip markdown code blocks from response', async () => {
      const mockResponse = {
        summary: 'Test summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '```json\n' + JSON.stringify(mockResponse) + '\n```'
      });

      const response = await novaService.callNova(
        NovaModel.MICRO,
        'Test prompt',
        'Test input'
      );

      expect(response.summary).toBe(mockResponse.summary);
      expect(response.actionItems).toEqual(mockResponse.actionItems);
    });

    it('should strip generic markdown code blocks from response', async () => {
      const mockResponse = {
        summary: 'Test summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => '```\n' + JSON.stringify(mockResponse) + '\n```'
      });

      const response = await novaService.callNova(
        NovaModel.LITE,
        'Test prompt',
        'Test input'
      );

      expect(response.summary).toBe(mockResponse.summary);
      expect(response.actionItems).toEqual(mockResponse.actionItems);
    });
  });

  describe('Model Selection', () => {
    it('should use NovaModel.LITE when specified', async () => {
      const mockResponse = {
        summary: 'Test',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockResponse)
      });

      const response = await novaService.callNova(
        NovaModel.LITE,
        'Test prompt',
        'Test input'
      );

      expect(response.model).toBe(NovaModel.LITE);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('amazon.nova-lite-v1')
        })
      );
    });

    it('should use NovaModel.MICRO when specified', async () => {
      const mockResponse = {
        summary: 'Test',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockResponse)
      });

      const response = await novaService.callNova(
        NovaModel.MICRO,
        'Test prompt',
        'Test input'
      );

      expect(response.model).toBe(NovaModel.MICRO);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('amazon.nova-micro-v1')
        })
      );
    });
  });

  describe('Request Construction', () => {
    it('should enhance system prompt with JSON instruction', async () => {
      const mockResponse = {
        summary: 'Test',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockResponse)
      });

      await novaService.callNova(
        NovaModel.MICRO,
        'Original prompt',
        'Test input'
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).toContain('Original prompt');
      expect(callBody.systemPrompt).toContain('CRITICAL: Return ONLY valid JSON');
    });

    it('should include correct headers', async () => {
      const mockResponse = {
        summary: 'Test',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockResponse)
      });

      await novaService.callNova(
        NovaModel.LITE,
        'Test prompt',
        'Test input'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });
  });
});
