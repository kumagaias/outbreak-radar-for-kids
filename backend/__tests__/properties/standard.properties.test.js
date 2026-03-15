/**
 * Standard Property-Based Tests for Backend Lambda
 * 
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 7.1, 7.2, 7.5**
 * 
 * Category: Standard (run daily, ~30s)
 * 
 * These tests validate business logic invariants:
 * - Model selection logic (Nova Lite vs Micro)
 * - Severity threshold transitions
 * - Fallback consistency
 */

const fc = require('fast-check');
const NovaService = require('../../lib/nova-service');
const { generateFallbackRecommendation } = require('../../lib/fallback-templates');

// Mock Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime');

// Test configuration
const PBT_CONFIG = {
  numRuns: 100,
  verbose: false
};

describe('Standard Properties - Model Selection Logic', () => {
  let novaService;

  beforeEach(() => {
    novaService = new NovaService('test-guardrail-id', 'DRAFT', 'us-east-1');
  });

  /**
   * Property: Nova Micro is selected for LOW and MEDIUM risk
   * 
   * Tests that cost optimization logic uses Nova Micro for low and medium risk
   * scenarios regardless of outbreak complexity.
   */
  it('Property: LOW risk always selects Nova Micro', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            diseaseName: fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
            severity: fc.integer({ min: 1, max: 10 }),
            affectedAgeRanges: fc.constant(['0-1', '2-3'])
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (outbreakData) => {
          const model = novaService.selectNovaModel('low', outbreakData);

          // LOW risk should always use Nova Micro
          expect(model).toBe('amazon.nova-micro-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: MEDIUM risk always selects Nova Micro', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            diseaseName: fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
            severity: fc.integer({ min: 4, max: 6 }),
            affectedAgeRanges: fc.constant(['0-1', '2-3'])
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (outbreakData) => {
          const model = novaService.selectNovaModel('medium', outbreakData);

          // MEDIUM risk should always use Nova Micro
          expect(model).toBe('amazon.nova-micro-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: HIGH risk with single disease selects Nova Micro', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19'),
        fc.integer({ min: 7, max: 10 }),
        (disease, severity) => {
          const outbreakData = [
            { diseaseName: disease, severity, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const model = novaService.selectNovaModel('high', outbreakData);

          // HIGH risk with single disease should use Nova Micro
          expect(model).toBe('amazon.nova-micro-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: HIGH risk with multiple high-severity diseases selects Nova Lite', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19'),
        fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19'),
        fc.integer({ min: 7, max: 10 }),
        fc.integer({ min: 7, max: 10 }),
        (disease1, disease2, severity1, severity2) => {
          fc.pre(disease1 !== disease2); // Ensure different diseases

          const outbreakData = [
            { diseaseName: disease1, severity: severity1, affectedAgeRanges: ['0-1', '2-3'] },
            { diseaseName: disease2, severity: severity2, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const model = novaService.selectNovaModel('high', outbreakData);

          // HIGH risk with multiple high-severity diseases should use Nova Lite
          expect(model).toBe('amazon.nova-lite-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: HIGH risk with one high-severity and one medium-severity disease selects Nova Micro', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19'),
        fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19'),
        fc.integer({ min: 7, max: 10 }),
        fc.integer({ min: 4, max: 6 }),
        (disease1, disease2, highSeverity, mediumSeverity) => {
          fc.pre(disease1 !== disease2); // Ensure different diseases

          const outbreakData = [
            { diseaseName: disease1, severity: highSeverity, affectedAgeRanges: ['0-1', '2-3'] },
            { diseaseName: disease2, severity: mediumSeverity, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const model = novaService.selectNovaModel('high', outbreakData);

          // Only one high-severity disease, should use Nova Micro
          expect(model).toBe('amazon.nova-micro-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Model selection is deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('low', 'medium', 'high'),
        fc.array(
          fc.record({
            diseaseName: fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
            severity: fc.integer({ min: 1, max: 10 }),
            affectedAgeRanges: fc.constant(['0-1', '2-3'])
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (riskLevel, outbreakData) => {
          const model1 = novaService.selectNovaModel(riskLevel, outbreakData);
          const model2 = novaService.selectNovaModel(riskLevel, outbreakData);

          // Same inputs should always produce same model selection
          expect(model1).toBe(model2);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Standard Properties - Fallback Consistency', () => {
  /**
   * Property: Fallback recommendations have consistent structure
   * 
   * Tests that fallback recommendations always return valid structure
   * with required fields regardless of input variations.
   */
  it('Property: Fallback always returns valid recommendation structure', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19', 'Hand-Foot-Mouth'),
          { minLength: 0, maxLength: 5 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US', 'New York, US'),
        (riskLevel, language, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          // Validate structure
          expect(recommendation).toHaveProperty('summary');
          expect(recommendation).toHaveProperty('actionItems');
          expect(recommendation).toHaveProperty('source', 'fallback');

          // Validate types
          expect(typeof recommendation.summary).toBe('string');
          expect(Array.isArray(recommendation.actionItems)).toBe(true);

          // Validate content
          expect(recommendation.summary.length).toBeGreaterThan(0);
          expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
          expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Fallback action items count is always 3-5', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 0, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (riskLevel, language, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          // Action items count should be 3-5
          expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
          expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Fallback summary mentions disease names for HIGH/MEDIUM risk', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium'),
        fc.constantFrom('ja', 'en'),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (riskLevel, language, area) => {
          const diseaseNames = ['RSV', 'Influenza'];

          const recommendation = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          // HIGH/MEDIUM risk should mention disease names
          const summaryLower = recommendation.summary.toLowerCase();
          const hasDiseaseMention = diseaseNames.some(disease => 
            summaryLower.includes(disease.toLowerCase()) ||
            summaryLower.includes('rsv') ||
            summaryLower.includes('influenza') ||
            summaryLower.includes('インフルエンザ')
          );

          expect(hasDiseaseMention).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Fallback is deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 0, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (riskLevel, language, diseaseNames, area) => {
          const recommendation1 = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          const recommendation2 = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          // Same inputs should produce identical recommendations
          expect(recommendation1.summary).toBe(recommendation2.summary);
          expect(recommendation1.actionItems).toEqual(recommendation2.actionItems);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Fallback language matches request language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 0, maxLength: 3 }
        ),
        (riskLevel, area, diseaseNames) => {
          const jaRecommendation = generateFallbackRecommendation(
            riskLevel,
            'ja',
            diseaseNames,
            area
          );

          const enRecommendation = generateFallbackRecommendation(
            riskLevel,
            'en',
            diseaseNames,
            area
          );

          // Japanese recommendation should contain Japanese characters
          expect(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(jaRecommendation.summary)).toBe(true);

          // English recommendation should not contain Japanese characters
          expect(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(enRecommendation.summary)).toBe(false);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Standard Properties - Severity Threshold Transitions', () => {
  /**
   * Property: Severity thresholds are applied consistently
   * 
   * Tests that severity-based logic (model selection, risk classification)
   * transitions correctly at threshold boundaries (4, 7).
   */
  it('Property: Severity < 7 with HIGH risk uses Nova Micro', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        (severity) => {
          const novaService = new NovaService('test-guardrail-id', 'DRAFT', 'us-east-1');

          const outbreakData = [
            { diseaseName: 'RSV', severity, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const model = novaService.selectNovaModel('high', outbreakData);

          // Severity < 7 means single high-severity disease doesn't exist
          // Should use Nova Micro
          expect(model).toBe('amazon.nova-micro-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Severity >= 7 threshold is applied consistently', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 7, max: 10 }),
        fc.integer({ min: 7, max: 10 }),
        (severity1, severity2) => {
          const novaService = new NovaService('test-guardrail-id', 'DRAFT', 'us-east-1');

          const outbreakData = [
            { diseaseName: 'RSV', severity: severity1, affectedAgeRanges: ['0-1', '2-3'] },
            { diseaseName: 'Influenza', severity: severity2, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const model = novaService.selectNovaModel('high', outbreakData);

          // Two diseases with severity >= 7 should use Nova Lite
          expect(model).toBe('amazon.nova-lite-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Exact threshold value 7 is classified as high-severity', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
        fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
        (disease1, disease2) => {
          fc.pre(disease1 !== disease2); // Ensure different diseases

          const novaService = new NovaService('test-guardrail-id', 'DRAFT', 'us-east-1');

          const outbreakData = [
            { diseaseName: disease1, severity: 7, affectedAgeRanges: ['0-1', '2-3'] },
            { diseaseName: disease2, severity: 7, affectedAgeRanges: ['0-1', '2-3'] }
          ];

          const model = novaService.selectNovaModel('high', outbreakData);

          // Severity exactly 7 should be treated as high-severity
          // Two high-severity diseases should use Nova Lite
          expect(model).toBe('amazon.nova-lite-v1:0');
        }
      ),
      PBT_CONFIG
    );
  });
});
