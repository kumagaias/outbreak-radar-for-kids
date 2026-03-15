/**
 * NovaService - Wrapper for Amazon Bedrock Nova API calls
 * Handles model selection, Guardrails, timeout, and error recovery
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { generateFallbackRecommendation } = require('./fallback-templates');
const PromptManager = require('./prompt-manager');
const SafetyValidator = require('./safety-validator');

class NovaService {
  constructor(guardrailId, guardrailVersion = 'DRAFT', region = 'us-east-1') {
    this.client = new BedrockRuntimeClient({ region });
    this.guardrailId = guardrailId;
    this.guardrailVersion = guardrailVersion;
    this.promptManager = new PromptManager(region);
    this.safetyValidator = new SafetyValidator();
    
    this.TIMEOUT_MS = 5000; // 5 seconds (considers ~200ms latency from us-east-1 to Japan)
    this.NOVA_LITE_MODEL = 'amazon.nova-lite-v1:0';
    this.NOVA_MICRO_MODEL = 'amazon.nova-micro-v1:0';
  }

  /**
   * Selects appropriate Nova model based on risk level and outbreak complexity
   * @param {string} riskLevel - Risk level (high, medium, low)
   * @param {Array} outbreakData - Outbreak data array
   * @returns {string} Model ID
   */
  selectNovaModel(riskLevel, outbreakData) {
    // Cost optimization: Use Nova Micro for LOW and MEDIUM risk
    if (riskLevel === 'low' || riskLevel === 'medium') {
      return this.NOVA_MICRO_MODEL;
    }
    
    // For HIGH risk, evaluate complexity
    if (riskLevel === 'high') {
      const highSeverityCount = outbreakData.filter(o => o.severity >= 7).length;
      
      // Use Lite only when multiple high-severity diseases are concurrent
      if (highSeverityCount >= 2) {
        return this.NOVA_LITE_MODEL;
      }
      
      // Single high-risk disease can be handled by Micro
      return this.NOVA_MICRO_MODEL;
    }
    
    return this.NOVA_MICRO_MODEL; // Default
  }

  /**
   * Builds system prompt for Nova based on language and context
   * Uses PromptManager to retrieve prompts from Parameter Store
   * @param {string} language - Language (ja, en)
   * @param {string} ageRange - Age range
   * @param {string} geographicArea - Geographic area
   * @param {Array<string>} diseaseNames - Disease names
   * @param {string} riskLevel - Risk level
   * @param {boolean} nearbyHotspot - Whether user is near a hotspot
   * @returns {Promise<Object>} Prompt object with content and version
   */
  async buildSystemPrompt(language, ageRange, geographicArea, diseaseNames, riskLevel, nearbyHotspot = false) {
    return await this.promptManager.buildSystemPrompt(
      language,
      ageRange,
      geographicArea,
      diseaseNames,
      riskLevel,
      nearbyHotspot
    );
  }

  /**
   * Generates recommendation using Nova API with Guardrails
   * @param {Object} request - Request object
   * @returns {Promise<Object>} Recommendation object
   */
  async generateRecommendation(request) {
    const { ageRange, geographicArea, riskLevel, language, diseaseNames, outbreakData, nearbyHotspot } = request;
    
    const startTime = Date.now();
    
    try {
      // Select model based on risk level and complexity
      const modelId = this.selectNovaModel(riskLevel, outbreakData);
      
      // Build system prompt using PromptManager
      const promptObject = await this.buildSystemPrompt(
        language,
        ageRange,
        geographicArea,
        diseaseNames,
        riskLevel,
        nearbyHotspot || false
      );
      
      // Log prompt version for correlation with feedback (Requirement 3.13)
      console.log('Nova API call metadata:', {
        language,
        promptVersion: promptObject.version,
        promptPath: promptObject.path,
        modelId,
        riskLevel,
        ageRange,
        geographicArea: geographicArea.split(',')[0].trim(), // Log only prefecture/state
        diseaseCount: diseaseNames.length,
        nearbyHotspot: nearbyHotspot || false
      });
      
      // Prepare request payload
      const payload = {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: promptObject.content
              }
            ]
          }
        ],
        inferenceConfig: {
          maxTokens: 500,
          temperature: 0.7
        }
      };
      
      // Create command with Guardrails
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
        guardrailIdentifier: this.guardrailId,
        guardrailVersion: this.guardrailVersion
      });
      
      // Execute with timeout
      const response = await this.executeWithTimeout(command, this.TIMEOUT_MS);
      
      // Parse response
      const latencyMs = Date.now() - startTime;
      const recommendation = this.parseNovaResponse(response, modelId, latencyMs);
      
      // Add metadata including prompt version
      recommendation.riskLevel = riskLevel;
      recommendation.diseaseNames = diseaseNames;
      recommendation.generatedAt = new Date().toISOString();
      recommendation.promptVersion = promptObject.version;
      recommendation.promptPath = promptObject.path;
      
      // Safety validation before returning (Requirement 13.8, 13.9)
      const childProfile = { ageRange };
      if (!this.safetyValidator.validateSafety(recommendation, childProfile)) {
        console.warn('Safety validation failed, using fallback recommendation');
        return generateFallbackRecommendation(riskLevel, language, diseaseNames, geographicArea);
      }
      
      return recommendation;
      
    } catch (error) {
      console.error('Nova API error:', error);
      
      // Check if Guardrail blocked the request/response
      if (error.name === 'GuardrailInterventionException' || error.message?.includes('guardrail')) {
        console.warn('Guardrail blocked request/response, using fallback');
      }
      
      // Return fallback recommendation
      return generateFallbackRecommendation(riskLevel, language, diseaseNames, geographicArea);
    }
  }

  /**
   * Executes command with timeout
   * @param {Object} command - Bedrock command
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Object>} Response
   */
  async executeWithTimeout(command, timeoutMs) {
    return Promise.race([
      this.client.send(command),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Nova service timeout after 5s')), timeoutMs)
      )
    ]);
  }

  /**
   * Parses Nova response and extracts recommendation
   * @param {Object} response - Bedrock response
   * @param {string} modelId - Model ID used
   * @param {number} latencyMs - Latency in milliseconds
   * @returns {Object} Parsed recommendation
   */
  parseNovaResponse(response, modelId, latencyMs) {
    try {
      // Decode response body
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Extract content from response
      let content = '';
      if (responseBody.output?.message?.content?.[0]?.text) {
        content = responseBody.output.message.content[0].text;
      } else if (responseBody.content?.[0]?.text) {
        content = responseBody.content[0].text;
      } else {
        throw new Error('Unexpected response format');
      }
      
      // Strip markdown code blocks if present
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse JSON
      const parsed = JSON.parse(cleaned);
      
      // Validate required fields
      if (!parsed.summary || !Array.isArray(parsed.actionItems)) {
        throw new Error('Missing required fields: summary or actionItems');
      }
      
      // Validate action items count (3-5)
      if (parsed.actionItems.length < 3 || parsed.actionItems.length > 5) {
        console.warn(`Action items count out of range: ${parsed.actionItems.length}`);
      }
      
      return {
        summary: parsed.summary,
        actionItems: parsed.actionItems,
        source: modelId.includes('lite') ? 'nova-lite' : 'nova-micro',
        modelLatencyMs: latencyMs
      };
      
    } catch (error) {
      console.error('Error parsing Nova response:', error);
      throw new Error(`Failed to parse Nova response: ${error.message}`);
    }
  }
}

module.exports = NovaService;
