/**
 * Property-based tests for fallback template system
 * 
 * Property 20: Fallback on Service Failure
 * Validates: Requirements 7.1, 7.2, 7.5
 */

import * as fc from 'fast-check';
import {
  getFallbackRecommendation,
  substituteTemplateVariables
} from '../fallback-templates';
import { RiskLevel, Language } from '../types';
import { PBT_CONFIG } from './test-generators';

describe('Fallback Templates Properties', () => {
  describe('Property 20: Fallback on Service Failure', () => {
    it('should always return valid recommendation for any risk level and language', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.array(
            fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'Hand-Foot-Mouth Disease'),
            { minLength: 0, maxLength: 5 }
          ),
          fc.constantFrom('Tokyo', 'Osaka', 'California', 'New York', 'Florida'),
          (riskLevel, language, diseaseNames, area) => {
            // Act: Get fallback recommendation
            const recommendation = getFallbackRecommendation(
              riskLevel,
              language,
              diseaseNames,
              area
            );

            // Assert: Recommendation should be valid
            expect(recommendation).toBeDefined();
            expect(recommendation.summary).toBeDefined();
            expect(typeof recommendation.summary).toBe('string');
            expect(recommendation.summary.length).toBeGreaterThan(0);

            expect(recommendation.actionItems).toBeDefined();
            expect(Array.isArray(recommendation.actionItems)).toBe(true);
            expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
            expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);

            // All action items should be non-empty strings
            for (const item of recommendation.actionItems) {
              expect(typeof item).toBe('string');
              expect(item.length).toBeGreaterThan(0);
            }
          }
        ),
        PBT_CONFIG
      );
    });

    it('should return same risk level as input (fallback maintains risk calculation)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
          fc.string(),
          (riskLevel, language, diseaseNames, area) => {
            // Act: Get fallback recommendation
            const recommendation = getFallbackRecommendation(
              riskLevel,
              language,
              diseaseNames,
              area
            );

            // Assert: Recommendation should exist and be appropriate for risk level
            expect(recommendation).toBeDefined();
            
            // Verify content matches risk level expectations
            const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');
            
            if (riskLevel === RiskLevel.HIGH) {
              // HIGH risk should mention monitoring or symptoms
              const hasMonitoringGuidance = 
                fullText.includes('症状') || 
                fullText.includes('観察') ||
                fullText.toLowerCase().includes('symptom') ||
                fullText.toLowerCase().includes('monitor');
              expect(hasMonitoringGuidance).toBe(true);
            } else if (riskLevel === RiskLevel.LOW) {
              // LOW risk should indicate normal attendance
              const indicatesNormalAttendance =
                fullText.includes('通常通り') ||
                fullText.toLowerCase().includes('normal attendance');
              expect(indicatesNormalAttendance).toBe(true);
            }
          }
        ),
        PBT_CONFIG
      );
    });

    it('should never contain alarmist language in fallback recommendations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
          fc.string(),
          (riskLevel, language, diseaseNames, area) => {
            // Act: Get fallback recommendation
            const recommendation = getFallbackRecommendation(
              riskLevel,
              language,
              diseaseNames,
              area
            );

            // Assert: Should not contain alarmist terms
            const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');
            const alarmistTerms = [
              'dangerous',
              'urgent',
              'emergency',
              'panic',
              'crisis',
              'deadly',
              '危険',
              '緊急',
              '非常事態'
            ];

            for (const term of alarmistTerms) {
              expect(fullText.toLowerCase()).not.toContain(term.toLowerCase());
            }
          }
        ),
        PBT_CONFIG
      );
    });

    it('should properly substitute variables in all templates', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.array(
            fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
            { minLength: 1, maxLength: 3 }
          ),
          fc.constantFrom('Tokyo', 'Osaka', 'California', 'New York'),
          (riskLevel, language, diseaseNames, area) => {
            // Act: Get fallback recommendation
            const recommendation = getFallbackRecommendation(
              riskLevel,
              language,
              diseaseNames,
              area
            );

            // Assert: Summary should contain the area
            expect(recommendation.summary).toContain(area);

            // Assert: Summary should contain at least one disease name or generic term
            const containsDisease = diseaseNames.some(disease =>
              recommendation.summary.includes(disease)
            );
            const containsGenericTerm = 
              recommendation.summary.includes('感染症') ||
              recommendation.summary.toLowerCase().includes('disease') ||
              recommendation.summary.toLowerCase().includes('outbreak') ||
              recommendation.summary.toLowerCase().includes('illness');

            expect(containsDisease || containsGenericTerm).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should maintain consistent action item count across all inputs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
          fc.string(),
          (riskLevel, language, diseaseNames, area) => {
            // Act: Get fallback recommendation
            const recommendation = getFallbackRecommendation(
              riskLevel,
              language,
              diseaseNames,
              area
            );

            // Assert: Action items should be between 3 and 5
            expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
            expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should use appropriate language for all outputs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.array(fc.string(), { minLength: 0, maxLength: 3 }),
          fc.string(),
          (riskLevel, language, diseaseNames, area) => {
            // Act: Get fallback recommendation
            const recommendation = getFallbackRecommendation(
              riskLevel,
              language,
              diseaseNames,
              area
            );

            const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

            if (language === Language.JAPANESE) {
              // Should contain Japanese characters
              const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(fullText);
              expect(hasJapanese).toBe(true);

              // Should use polite form
              const hasPoliteForm = 
                fullText.includes('です') ||
                fullText.includes('ます') ||
                fullText.includes('ません');
              expect(hasPoliteForm).toBe(true);
            } else {
              // English should not contain Japanese characters
              const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(fullText);
              expect(hasJapanese).toBe(false);
            }
          }
        ),
        PBT_CONFIG
      );
    });
  });

  describe('Variable Substitution Properties', () => {
    it('should always replace all variable placeholders', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (diseaseNames, area) => {
            // Arrange: Create template with variables
            const template = 'Outbreaks of {diseaseNames} in {area}';

            // Act: Substitute variables
            const result = substituteTemplateVariables(template, {
              diseaseNames,
              area
            });

            // Assert: No placeholders should remain
            expect(result).not.toContain('{diseaseNames}');
            expect(result).not.toContain('{area}');

            // Assert: Values should be present
            expect(result).toContain(diseaseNames);
            expect(result).toContain(area);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should handle empty strings in variable substitution', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', 'RSV', 'Influenza'),
          fc.constantFrom('', 'Tokyo', 'California'),
          (diseaseNames, area) => {
            // Arrange: Create template
            const template = '{diseaseNames} in {area}';

            // Act: Substitute variables
            const result = substituteTemplateVariables(template, {
              diseaseNames,
              area
            });

            // Assert: No placeholders should remain
            expect(result).not.toContain('{diseaseNames}');
            expect(result).not.toContain('{area}');
            
            // Assert: Result should not contain "$ " pattern (edge case)
            expect(result).not.toMatch(/\$\s+/);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should preserve template structure when substituting variables', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          (diseaseNames, area) => {
            // Arrange: Template with known structure
            const template = 'Start {diseaseNames} middle {area} end';

            // Act: Substitute variables
            const result = substituteTemplateVariables(template, {
              diseaseNames,
              area
            });

            // Assert: Structure should be preserved
            expect(result).toMatch(/^Start .+ middle .+ end$/);
            expect(result.startsWith('Start ')).toBe(true);
            expect(result.endsWith(' end')).toBe(true);
            expect(result).toContain(' middle ');
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
