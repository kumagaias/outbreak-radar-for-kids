/**
 * Nova_Service wrapper for Amazon Nova Lite/Micro API calls
 * Handles timeout, error recovery, and JSON parsing
 */

import { NovaTimeoutError, NovaServiceError } from './errors';

export enum NovaModel {
  LITE = 'amazon.nova-lite-v1',
  MICRO = 'amazon.nova-micro-v1'
}

export interface NovaResponse {
  summary: string;
  actionItems: string[];
  model: NovaModel;
  latencyMs: number;
}

export interface NovaRequest {
  model: NovaModel;
  systemPrompt: string;
  userInput: string;
  temperature?: number;
  maxTokens?: number;
}

export class NovaService {
  private readonly TIMEOUT_MS = 5000;
  private readonly apiEndpoint: string;
  private readonly apiKey: string;

  constructor(apiEndpoint: string, apiKey: string) {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  async callNova(
    model: NovaModel,
    systemPrompt: string,
    userInput: string
  ): Promise<NovaResponse> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          systemPrompt: this.enhanceSystemPromptForJSON(systemPrompt),
          userInput: userInput,
          temperature: 0.7,
          maxTokens: 500,
          responseFormat: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NovaServiceError(
          `Nova API returned status ${response.status}: ${response.statusText}`
        );
      }

      const rawResponse = await response.text();
      const latencyMs = Date.now() - startTime;

      const parsed = this.parseNovaResponse(rawResponse);

      return {
        ...parsed,
        model,
        latencyMs
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new NovaTimeoutError('Nova service timeout after 5s');
      }

      if (error instanceof NovaServiceError || error instanceof NovaTimeoutError) {
        throw error;
      }

      throw new NovaServiceError(`Nova service error: ${error.message}`);
    }
  }

  private enhanceSystemPromptForJSON(systemPrompt: string): string {
    return (
      systemPrompt +
      '\n\nCRITICAL: Return ONLY valid JSON. No markdown code blocks, no explanations, no additional text. Just the JSON object.'
    );
  }

  private parseNovaResponse(rawResponse: string): Omit<NovaResponse, 'model' | 'latencyMs'> {
    // Strip markdown code blocks if present
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      // Validate required fields
      if (!parsed.summary || !Array.isArray(parsed.actionItems)) {
        throw new Error('Missing required fields: summary or actionItems');
      }

      // Validate actionItems is array of strings
      if (!parsed.actionItems.every((item: any) => typeof item === 'string')) {
        throw new Error('actionItems must be an array of strings');
      }

      return {
        summary: parsed.summary,
        actionItems: parsed.actionItems
      };
    } catch (error: any) {
      throw new NovaServiceError(`Failed to parse Nova response: ${error.message}`);
    }
  }
}
