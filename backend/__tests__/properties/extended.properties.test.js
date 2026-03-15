/**
 * Extended Property-Based Tests for Backend Lambda
 * 
 * **Validates: Requirements 3.4, 3.5, 2.1, 2.2, 2.3, 2.4, 4.5, 4.6, 4.7, 8.3, 8.4**
 * 
 * Category: Extended (run pre-deploy, ~85s total)
 * 
 * These tests validate content quality and cultural appropriateness:
 * - Tone validation (no alarmist language, no medical diagnosis)
 * - Cultural appropriateness (Japanese fever thresholds, MHLW guidelines)
 * - Action item age-appropriateness
 */

const fc = require('fast-check');
const { generateFallbackRecommendation } = require('../../lib/fallback-templates');

// Test configuration
const PBT_CONFIG = {
  numRuns: 100,
  verbose: false
};

describe('Extended Properties - Tone Validation', () => {
  /**
   * Property: Recommendations never contain alarmist language
   * 
   * Tests that generated recommendations avoid fear-based language
   * and maintain calm, supportive tone.
   */
  it('Property: Fallback recommendations never contain alarmist language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus', 'COVID-19'),
          { minLength: 0, maxLength: 5 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (riskLevel, language, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Check for alarmist language patterns
          const alarmistPatterns = [
            /危険/gi,
            /緊急/gi,
            /重大/gi,
            /深刻/gi,
            /dangerous/gi,
            /urgent/gi,
            /emergency/gi,
            /severe danger/gi,
            /crisis/gi
          ];

          for (const pattern of alarmistPatterns) {
            expect(pattern.test(fullText)).toBe(false);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Recommendations never contain medical diagnosis phrases', () => {
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

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Check for medical diagnosis patterns
          const diagnosisPatterns = [
            /疑いがあります/gi,
            /suspected of/gi,
            /diagnosed with/gi,
            /has [a-z\s]+ disease/gi,
            /お子様は.*です/gi,
            /your child has/gi
          ];

          for (const pattern of diagnosisPatterns) {
            expect(pattern.test(fullText)).toBe(false);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Recommendations use action-oriented language', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 } // Ensure at least one disease
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (riskLevel, language, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          // Action items should contain action verbs (case-insensitive)
          const actionVerbs = language === 'ja'
            ? ['する', '確認', '実施', '行う', '徹底', '維持', '継続', '講じ']
            : ['check', 'monitor', 'practice', 'ensure', 'watch', 'maintain', 'continue', 'contact', 'consult', 'obtain', 'stay', 'keep'];

          const hasActionVerbs = recommendation.actionItems.some(item => {
            const itemLower = item.toLowerCase();
            return actionVerbs.some(verb => itemLower.includes(verb.toLowerCase()));
          });

          expect(hasActionVerbs).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Recommendations avoid vague terms', () => {
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

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Check for vague terms
          const vaguePatterns = [
            /be careful/gi,
            /stay safe/gi,
            /気をつけて/gi,
            /注意して/gi
          ];

          // Vague terms should be minimal or absent
          const vagueCount = vaguePatterns.reduce((count, pattern) => {
            const matches = fullText.match(pattern);
            return count + (matches ? matches.length : 0);
          }, 0);

          // Allow at most 1 vague term per recommendation
          expect(vagueCount).toBeLessThanOrEqual(1);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Extended Properties - Cultural Appropriateness (Japanese)', () => {
  /**
   * Property: Japanese recommendations reference appropriate fever thresholds
   * 
   * Tests that Japanese recommendations use 37.5°C fever threshold
   * consistent with Japanese childcare norms.
   */
  it('Property: Japanese HIGH risk recommendations mention 37.5°C threshold', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'Kyoto, JP'),
        (diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            'high',
            'ja',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should mention 37.5°C threshold for Japanese context
          const has375Threshold = /37\.5/.test(fullText);

          expect(has375Threshold).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Japanese recommendations use polite form (desu/masu)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 } // Ensure at least one disease
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'Kyoto, JP'),
        (riskLevel, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            'ja',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should contain polite form endings
          const politePatterns = [
            /です/g,
            /ます/g,
            /ください/g,
            /しょう/g,
            /ません/g
          ];

          const hasPoliteForm = politePatterns.some(pattern => pattern.test(fullText));

          expect(hasPoliteForm).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Japanese recommendations reference childcare attendance standards', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'Kyoto, JP'),
        (diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            'high',
            'ja',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should reference childcare attendance concepts
          const attendancePatterns = [
            /登園/g,
            /保育園/g,
            /幼稚園/g
          ];

          const hasAttendanceReference = attendancePatterns.some(pattern => pattern.test(fullText));

          expect(hasAttendanceReference).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Japanese HIGH risk recommendations mention symptom observation', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'Kyoto, JP'),
        (diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            'high',
            'ja',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should mention symptom observation
          const symptomPatterns = [
            /症状/g,
            /咳/g,
            /鼻水/g,
            /下痢/g,
            /嘔吐/g,
            /発熱/g
          ];

          const hasSymptomMention = symptomPatterns.some(pattern => pattern.test(fullText));

          expect(hasSymptomMention).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Extended Properties - Cultural Appropriateness (English)', () => {
  /**
   * Property: English recommendations use appropriate fever thresholds
   * 
   * Tests that English recommendations use 99.5°F or 100.4°F thresholds
   * consistent with US childcare norms.
   */
  it('Property: English HIGH risk recommendations mention fever threshold', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.constantFrom('California, US', 'New York, US', 'Texas, US'),
        (diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            'high',
            'en',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should mention fever threshold in Fahrenheit
          const hasFeverThreshold = /99\.5|100\.4|°F|degrees/.test(fullText);

          expect(hasFeverThreshold).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: English recommendations use declarative sentences', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 0, maxLength: 3 }
        ),
        fc.constantFrom('California, US', 'New York, US', 'Texas, US'),
        (riskLevel, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            'en',
            diseaseNames,
            area
          );

          // Action items should be declarative (not questions)
          const hasQuestions = recommendation.actionItems.some(item => item.includes('?'));

          expect(hasQuestions).toBe(false);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: English recommendations reference daycare attendance', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.constantFrom('California, US', 'New York, US', 'Texas, US'),
        (diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            'high',
            'en',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should reference daycare attendance concepts
          const attendancePatterns = [
            /daycare/gi,
            /childcare/gi,
            /preschool/gi,
            /attendance/gi
          ];

          const hasAttendanceReference = attendancePatterns.some(pattern => pattern.test(fullText));

          expect(hasAttendanceReference).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Extended Properties - Action Item Age-Appropriateness', () => {
  /**
   * Property: Action items are age-appropriate
   * 
   * Tests that action items don't include instructions inappropriate
   * for the child's age (e.g., no "gargle" for infants).
   */
  it('Property: Infant recommendations do not include child-directed actions', () => {
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

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Infant-inappropriate patterns (actions directed AT the child)
          const infantInappropriatePatterns = [
            /うがいをし/gi, // "do gargling" (action instruction)
            /gargle/gi,
            /rinse.*mouth/gi
          ];

          // Note: "保護者が手洗いを徹底" (caregivers wash hands) is acceptable
          // We're checking for instructions directed at the child, not caregivers

          for (const pattern of infantInappropriatePatterns) {
            expect(pattern.test(fullText)).toBe(false);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: All recommendations include hygiene-related actions', () => {
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

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should include hygiene-related actions
          const hygienePatterns = language === 'ja'
            ? [/手洗い/g, /消毒/g, /アルコール/g]
            : [/handwashing/gi, /hand washing/gi, /sanitizer/gi, /wash.*hands/gi];

          const hasHygieneAction = hygienePatterns.some(pattern => pattern.test(fullText));

          expect(hasHygieneAction).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: HIGH risk recommendations include monitoring actions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (language, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            'high',
            language,
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Should include monitoring actions
          const monitoringPatterns = language === 'ja'
            ? [/確認/g, /観察/g, /検温/g, /症状/g]
            : [/monitor/gi, /watch/gi, /check/gi, /observe/gi];

          const hasMonitoringAction = monitoringPatterns.some(pattern => pattern.test(fullText));

          expect(hasMonitoringAction).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Action items are behaviorally specific (minimum length)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.constantFrom('ja', 'en'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 1, maxLength: 3 } // Ensure at least one disease
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'California, US'),
        (riskLevel, language, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            language,
            diseaseNames,
            area
          );

          // Each action item should be reasonably specific (not too short)
          // Japanese characters count as 3 bytes, so use lower threshold
          const minLength = language === 'ja' ? 5 : 10;
          const allSpecific = recommendation.actionItems.every(item => item.length >= minLength);

          expect(allSpecific).toBe(true);
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('Extended Properties - Temperature Threshold Validation', () => {
  /**
   * Property: Temperature thresholds are within valid ranges
   * 
   * Tests that temperature values mentioned in recommendations
   * are within physiologically valid ranges.
   */
  it('Property: Celsius temperatures are within valid range (36-42°C)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 0, maxLength: 3 }
        ),
        fc.constantFrom('Tokyo, JP', 'Osaka, JP', 'Kyoto, JP'),
        (riskLevel, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            'ja',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Extract Celsius temperatures
          const celsiusPattern = /(\d+\.?\d*)\s*°?C/gi;
          const matches = [...fullText.matchAll(celsiusPattern)];

          for (const match of matches) {
            const temp = parseFloat(match[1]);
            expect(temp).toBeGreaterThanOrEqual(36.0);
            expect(temp).toBeLessThanOrEqual(42.0);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('Property: Fahrenheit temperatures are within valid range (96.8-107.6°F)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('high', 'medium', 'low'),
        fc.array(
          fc.constantFrom('RSV', 'Influenza', 'Norovirus'),
          { minLength: 0, maxLength: 3 }
        ),
        fc.constantFrom('California, US', 'New York, US', 'Texas, US'),
        (riskLevel, diseaseNames, area) => {
          const recommendation = generateFallbackRecommendation(
            riskLevel,
            'en',
            diseaseNames,
            area
          );

          const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

          // Extract Fahrenheit temperatures
          const fahrenheitPattern = /(\d+\.?\d*)\s*°?F/gi;
          const matches = [...fullText.matchAll(fahrenheitPattern)];

          for (const match of matches) {
            const temp = parseFloat(match[1]);
            expect(temp).toBeGreaterThanOrEqual(96.8);
            expect(temp).toBeLessThanOrEqual(107.6);
          }
        }
      ),
      PBT_CONFIG
    );
  });
});
