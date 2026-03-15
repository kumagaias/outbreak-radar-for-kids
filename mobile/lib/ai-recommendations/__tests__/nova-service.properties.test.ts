/**
 * Property-based tests for Nova_Service
 * Tests universal properties across all inputs
 */

import fc from 'fast-check';
import { NovaService, NovaModel, NovaResponse } from '../nova-service';
import { NovaTimeoutError, NovaServiceError } from '../errors';

const PBT_CONFIG = {
  numRuns: 100,
  timeout: 10000,
  verbose: true
};

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('Nova_Service Properties', () => {
  let novaService: NovaService;

  beforeEach(() => {
    novaService = new NovaService('https://api.example.com/nova', 'test-api-key');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Property 11: Structured Output Format - Feature: nova-ai-recommendations', async () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * For any Nova_Service call, the response SHALL contain both a summary field
     * and an actionItems array field.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(NovaModel.LITE, NovaModel.MICRO),
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 3, maxLength: 5 }),
        async (model, systemPrompt, userInput, actionItems) => {
          // Mock successful Nova response
          const mockResponse = {
            summary: 'Test summary for outbreak guidance',
            actionItems: actionItems
          };

          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => JSON.stringify(mockResponse)
          });

          const response = await novaService.callNova(model, systemPrompt, userInput);

          // Verify structured output format
          expect(response).toHaveProperty('summary');
          expect(response).toHaveProperty('actionItems');
          expect(typeof response.summary).toBe('string');
          expect(Array.isArray(response.actionItems)).toBe(true);
          expect(response.actionItems.length).toBeGreaterThanOrEqual(3);
          expect(response.actionItems.length).toBeLessThanOrEqual(5);
          
          // Verify all action items are strings
          response.actionItems.forEach(item => {
            expect(typeof item).toBe('string');
          });

          // Verify response includes model and latency
          expect(response.model).toBe(model);
          expect(typeof response.latencyMs).toBe('number');
          expect(response.latencyMs).toBeGreaterThanOrEqual(0);
        }
      ),
      PBT_CONFIG
    );
  });
});
