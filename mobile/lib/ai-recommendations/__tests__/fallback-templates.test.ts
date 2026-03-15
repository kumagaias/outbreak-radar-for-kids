/**
 * Unit tests for fallback template system
 * 
 * Tests:
 * - Template variable substitution
 * - Temperature thresholds (37.5°C for Japanese, 99.5°F for English)
 * - Tone matching (non-alarmist, action-oriented)
 * - Medical clearance requirements
 */

import {
  FALLBACK_TEMPLATES,
  getFallbackRecommendation,
  substituteTemplateVariables,
  checkMedicalClearanceRequired,
  DISEASES_REQUIRING_CLEARANCE_JP
} from '../fallback-templates';
import { RiskLevel, Language } from '../types';

describe('Fallback Templates', () => {
  describe('Template Structure', () => {
    it('should have templates for all risk levels and languages', () => {
      const riskLevels = [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW];
      const languages = [Language.JAPANESE, Language.ENGLISH];

      for (const riskLevel of riskLevels) {
        for (const language of languages) {
          const template = FALLBACK_TEMPLATES[riskLevel][language];
          expect(template).toBeDefined();
          expect(template.summary).toBeDefined();
          expect(template.actionItems).toBeDefined();
          expect(Array.isArray(template.actionItems)).toBe(true);
        }
      }
    });

    it('should have 3-5 action items for each template', () => {
      const riskLevels = [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW];
      const languages = [Language.JAPANESE, Language.ENGLISH];

      for (const riskLevel of riskLevels) {
        for (const language of languages) {
          const template = FALLBACK_TEMPLATES[riskLevel][language];
          expect(template.actionItems.length).toBeGreaterThanOrEqual(3);
          expect(template.actionItems.length).toBeLessThanOrEqual(5);
        }
      }
    });
  });

  describe('Variable Substitution', () => {
    it('should substitute {diseaseNames} variable', () => {
      const template = 'Outbreaks of {diseaseNames} have been reported.';
      const result = substituteTemplateVariables(template, {
        diseaseNames: 'RSV and Influenza',
        area: 'Tokyo'
      });
      expect(result).toBe('Outbreaks of RSV and Influenza have been reported.');
    });

    it('should substitute {area} variable', () => {
      const template = 'Cases are increasing in {area}.';
      const result = substituteTemplateVariables(template, {
        diseaseNames: 'RSV',
        area: 'California'
      });
      expect(result).toBe('Cases are increasing in California.');
    });

    it('should substitute multiple variables in same template', () => {
      const template = '{diseaseNames} in {area}';
      const result = substituteTemplateVariables(template, {
        diseaseNames: 'Norovirus',
        area: 'Osaka'
      });
      expect(result).toBe('Norovirus in Osaka');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{area} has {area} cases';
      const result = substituteTemplateVariables(template, {
        diseaseNames: 'RSV',
        area: 'Tokyo'
      });
      expect(result).toBe('Tokyo has Tokyo cases');
    });
  });

  describe('Temperature Thresholds', () => {
    it('should include 37.5°C threshold in Japanese HIGH risk template', () => {
      const template = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.JAPANESE];
      const actionItemsText = template.actionItems.join(' ');
      expect(actionItemsText).toContain('37.5℃');
    });

    it('should include 99.5°F threshold in English HIGH risk template', () => {
      const template = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.ENGLISH];
      const actionItemsText = template.actionItems.join(' ');
      expect(actionItemsText).toContain('99.5°F');
    });

    it('should mention checking temperature before attendance in HIGH risk', () => {
      const japaneseTemplate = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.JAPANESE];
      const englishTemplate = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.ENGLISH];

      const japaneseText = japaneseTemplate.actionItems.join(' ');
      const englishText = englishTemplate.actionItems.join(' ');

      expect(japaneseText).toContain('検温');
      expect(englishText.toLowerCase()).toContain('temperature');
    });
  });

  describe('Tone Matching', () => {
    it('should not contain alarmist terms in any template', () => {
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

      const riskLevels = [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW];
      const languages = [Language.JAPANESE, Language.ENGLISH];

      for (const riskLevel of riskLevels) {
        for (const language of languages) {
          const template = FALLBACK_TEMPLATES[riskLevel][language];
          const fullText = template.summary + ' ' + template.actionItems.join(' ');

          for (const term of alarmistTerms) {
            expect(fullText.toLowerCase()).not.toContain(term.toLowerCase());
          }
        }
      }
    });

    it('should use action-oriented language (verbs)', () => {
      const japaneseActionVerbs = ['確認', '実施', '徹底', '継続', '維持'];
      const englishActionVerbs = ['check', 'watch', 'practice', 'contact', 'ensure', 'monitor', 'maintain'];

      const japaneseTemplate = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.JAPANESE];
      const englishTemplate = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.ENGLISH];

      const japaneseText = japaneseTemplate.actionItems.join(' ');
      const englishText = englishTemplate.actionItems.join(' ').toLowerCase();

      // At least one Japanese action verb should be present
      const hasJapaneseVerb = japaneseActionVerbs.some(verb => japaneseText.includes(verb));
      expect(hasJapaneseVerb).toBe(true);

      // At least one English action verb should be present
      const hasEnglishVerb = englishActionVerbs.some(verb => englishText.includes(verb));
      expect(hasEnglishVerb).toBe(true);
    });

    it('should not contain vague terms like "be careful" or "stay safe"', () => {
      const vagueTerms = [
        'be careful',
        'stay safe',
        'be cautious',
        '気をつけて',
        '注意して'
      ];

      const riskLevels = [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW];
      const languages = [Language.JAPANESE, Language.ENGLISH];

      for (const riskLevel of riskLevels) {
        for (const language of languages) {
          const template = FALLBACK_TEMPLATES[riskLevel][language];
          const fullText = template.summary + ' ' + template.actionItems.join(' ');

          for (const term of vagueTerms) {
            expect(fullText.toLowerCase()).not.toContain(term.toLowerCase());
          }
        }
      }
    });

    it('should use polite form (です・ます) in Japanese templates', () => {
      const riskLevels = [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW];

      for (const riskLevel of riskLevels) {
        const template = FALLBACK_TEMPLATES[riskLevel][Language.JAPANESE];
        const fullText = template.summary + ' ' + template.actionItems.join(' ');

        // Should contain polite form markers
        const hasPoliteForm = fullText.includes('です') || 
                             fullText.includes('ます') ||
                             fullText.includes('ません');
        expect(hasPoliteForm).toBe(true);
      }
    });
  });

  describe('getFallbackRecommendation', () => {
    it('should return recommendation with substituted variables', () => {
      const result = getFallbackRecommendation(
        RiskLevel.HIGH,
        Language.ENGLISH,
        ['RSV', 'Influenza'],
        'Tokyo'
      );

      expect(result.summary).toContain('RSV');
      expect(result.summary).toContain('Influenza');
      expect(result.summary).toContain('Tokyo');
      expect(result.actionItems.length).toBeGreaterThanOrEqual(3);
    });

    it('should format single disease name correctly', () => {
      const result = getFallbackRecommendation(
        RiskLevel.MEDIUM,
        Language.ENGLISH,
        ['RSV'],
        'California'
      );

      expect(result.summary).toContain('RSV');
      expect(result.summary).not.toContain('and');
    });

    it('should format two disease names with "and" in English', () => {
      const result = getFallbackRecommendation(
        RiskLevel.HIGH,
        Language.ENGLISH,
        ['RSV', 'Influenza'],
        'New York'
      );

      expect(result.summary).toContain('RSV and Influenza');
    });

    it('should format three disease names with commas and "and" in English', () => {
      const result = getFallbackRecommendation(
        RiskLevel.HIGH,
        Language.ENGLISH,
        ['RSV', 'Influenza', 'Norovirus'],
        'Florida'
      );

      expect(result.summary).toContain('RSV, Influenza, and Norovirus');
    });

    it('should format disease names with 、 in Japanese', () => {
      const result = getFallbackRecommendation(
        RiskLevel.HIGH,
        Language.JAPANESE,
        ['RSV', 'インフルエンザ'],
        '東京'
      );

      expect(result.summary).toContain('RSV、インフルエンザ');
    });

    it('should use default disease name when empty array provided', () => {
      const englishResult = getFallbackRecommendation(
        RiskLevel.MEDIUM,
        Language.ENGLISH,
        [],
        'California'
      );

      const japaneseResult = getFallbackRecommendation(
        RiskLevel.MEDIUM,
        Language.JAPANESE,
        [],
        '東京'
      );

      expect(englishResult.summary).toContain('infectious diseases');
      expect(japaneseResult.summary).toContain('感染症');
    });
  });

  describe('Medical Clearance Requirements', () => {
    it('should identify diseases requiring clearance in Japanese', () => {
      const requiresClearance = checkMedicalClearanceRequired([
        'インフルエンザ',
        'RSウイルス感染症'
      ]);
      expect(requiresClearance).toBe(true);
    });

    it('should identify diseases requiring clearance in English', () => {
      const requiresClearance = checkMedicalClearanceRequired([
        'Influenza',
        'RSV'
      ]);
      expect(requiresClearance).toBe(true);
    });

    it('should return false for diseases not requiring clearance', () => {
      const requiresClearance = checkMedicalClearanceRequired([
        'Common Cold',
        'Mild Cough'
      ]);
      expect(requiresClearance).toBe(false);
    });

    it('should handle case-insensitive matching', () => {
      const requiresClearance = checkMedicalClearanceRequired([
        'influenza',
        'STREP THROAT'
      ]);
      expect(requiresClearance).toBe(true);
    });

    it('should handle partial name matching', () => {
      const requiresClearance = checkMedicalClearanceRequired([
        'Influenza Type A',
        'RSV Infection'
      ]);
      expect(requiresClearance).toBe(true);
    });

    it('should include all required diseases in the list', () => {
      const expectedDiseases = [
        'インフルエンザ',
        'RSウイルス感染症',
        '溶連菌感染症',
        '水痘',
        '流行性耳下腺炎',
        '風疹',
        '麻疹',
        '百日咳'
      ];

      for (const disease of expectedDiseases) {
        expect(DISEASES_REQUIRING_CLEARANCE_JP).toContain(disease);
      }
    });
  });

  describe('Risk-Appropriate Content', () => {
    it('should include monitoring guidance in HIGH risk templates', () => {
      const japaneseTemplate = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.JAPANESE];
      const englishTemplate = FALLBACK_TEMPLATES[RiskLevel.HIGH][Language.ENGLISH];

      const japaneseText = japaneseTemplate.actionItems.join(' ');
      const englishText = englishTemplate.actionItems.join(' ');

      // Should mention monitoring symptoms
      expect(japaneseText).toContain('症状');
      expect(englishText.toLowerCase()).toContain('symptom');
    });

    it('should include preventive measures in MEDIUM risk templates', () => {
      const japaneseTemplate = FALLBACK_TEMPLATES[RiskLevel.MEDIUM][Language.JAPANESE];
      const englishTemplate = FALLBACK_TEMPLATES[RiskLevel.MEDIUM][Language.ENGLISH];

      const japaneseText = japaneseTemplate.actionItems.join(' ');
      const englishText = englishTemplate.actionItems.join(' ');

      // Should mention handwashing or preventive measures
      expect(japaneseText).toContain('手洗い');
      expect(englishText.toLowerCase()).toContain('handwashing');
    });

    it('should indicate normal attendance in LOW risk templates', () => {
      const japaneseTemplate = FALLBACK_TEMPLATES[RiskLevel.LOW][Language.JAPANESE];
      const englishTemplate = FALLBACK_TEMPLATES[RiskLevel.LOW][Language.ENGLISH];

      // Summary should indicate normal attendance is appropriate
      expect(japaneseTemplate.summary).toContain('通常通り');
      expect(englishTemplate.summary.toLowerCase()).toContain('normal attendance');
    });
  });
});
