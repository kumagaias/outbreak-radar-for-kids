/**
 * Property-based tests for system prompt templates
 * 
 * Tests Properties 12-16:
 * - Property 12: Non-Alarmist Tone
 * - Property 13: Medical Diagnosis Prohibition
 * - Property 14: Disease Name Inclusion
 * - Property 15: Language Output Matching
 * - Property 16: Japanese Polite Form
 */

import * as fc from 'fast-check';
import {
  generateSystemPrompt,
  generateJapaneseSystemPrompt,
  generateEnglishSystemPrompt,
  SystemPromptContext
} from '../system-prompts';
import { AgeRange, Language, RiskLevel } from '../types';
import { PBT_CONFIG } from './test-generators';

/**
 * Generate random SystemPromptContext
 */
function systemPromptContextArbitrary(): fc.Arbitrary<SystemPromptContext> {
  return fc.record({
    ageRange: fc.constantFrom(
      AgeRange.INFANT,
      AgeRange.TODDLER,
      AgeRange.PRESCHOOL,
      AgeRange.SCHOOL_AGE
    ),
    geographicArea: fc.constantFrom(
      'Tokyo, JP',
      'Osaka, JP',
      'California, US',
      'New York, US'
    ),
    diseaseNames: fc.array(
      fc.constantFrom(
        'RSV',
        'Influenza',
        'Hand-Foot-Mouth Disease',
        'Norovirus',
        'COVID-19'
      ),
      { minLength: 1, maxLength: 3 }
    ),
    riskLevel: fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
    language: fc.constantFrom(Language.JAPANESE, Language.ENGLISH)
  });
}

describe('System Prompt Properties', () => {
  /**
   * Property 12: Non-Alarmist Tone
   * Validates: Requirements 3.4
   * 
   * For any system prompt context, the generated prompt SHALL NOT contain
   * alarmist language such as "panic", "crisis", "deadly", or "severe danger".
   */
  it('Property 12: Non-Alarmist Tone - Feature: nova-ai-recommendations', () => {
    fc.assert(
      fc.property(systemPromptContextArbitrary(), (context) => {
        const prompt = generateSystemPrompt(context);

        // Alarmist terms to check (case-insensitive)
        const alarmistTerms = [
          /panic/i,
          /crisis/i,
          /deadly/i,
          /severe danger/i,
          /catastrophic/i,
          /disaster/i,
          /パニック/,
          /危機/,
          /致命的/,
          /重大な危険/
        ];

        // Check that none of the alarmist terms appear in the prompt
        for (const term of alarmistTerms) {
          expect(prompt).not.toMatch(term);
        }
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property 13: Medical Diagnosis Prohibition
   * Validates: Requirements 3.5
   * 
   * For any system prompt context, the generated prompt SHALL explicitly prohibit
   * medical diagnosis phrases such as "your child has", "diagnosed with", or "treatment for".
   */
  it('Property 13: Medical Diagnosis Prohibition - Feature: nova-ai-recommendations', () => {
    fc.assert(
      fc.property(systemPromptContextArbitrary(), (context) => {
        const prompt = generateSystemPrompt(context);

        // Check that the prompt contains prohibition instructions
        const prohibitionKeywords = context.language === Language.JAPANESE
          ? ['禁止', '診断', 'お子様は']
          : ['PROHIBITED', 'diagnosis', 'your child has'];

        // At least one prohibition keyword should be present
        const hasProhibition = prohibitionKeywords.some(keyword =>
          prompt.includes(keyword)
        );
        expect(hasProhibition).toBe(true);

        // Check specific prohibited phrases are mentioned in the prompt
        if (context.language === Language.JAPANESE) {
          expect(prompt).toMatch(/疑いがあります|診断されました|感染しています/);
        } else {
          expect(prompt).toMatch(/suspected of|diagnosed with|infected with/);
        }
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property 14: Disease Name Inclusion
   * Validates: Requirements 3.6
   * 
   * For any system prompt context with disease names, the generated prompt
   * SHALL include the disease names in the context section.
   */
  it('Property 14: Disease Name Inclusion - Feature: nova-ai-recommendations', () => {
    fc.assert(
      fc.property(systemPromptContextArbitrary(), (context) => {
        const prompt = generateSystemPrompt(context);

        // Check that all disease names appear in the prompt
        for (const diseaseName of context.diseaseNames) {
          expect(prompt).toContain(diseaseName);
        }

        // Check that the context section mentions current outbreaks
        if (context.language === Language.JAPANESE) {
          expect(prompt).toContain('現在の流行');
        } else {
          expect(prompt).toContain('Current outbreaks');
        }
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property 15: Language Output Matching
   * Validates: Requirements 3.7, 8.1, 8.2
   * 
   * For any system prompt context, when language is Japanese, the prompt SHALL
   * be in Japanese; when language is English, the prompt SHALL be in English.
   */
  it('Property 15: Language Output Matching - Feature: nova-ai-recommendations', () => {
    fc.assert(
      fc.property(systemPromptContextArbitrary(), (context) => {
        const prompt = generateSystemPrompt(context);

        if (context.language === Language.JAPANESE) {
          // Check for Japanese-specific keywords
          const japaneseKeywords = ['あなたは', 'です', 'ます', '保育', '助言'];
          const hasJapanese = japaneseKeywords.some(keyword =>
            prompt.includes(keyword)
          );
          expect(hasJapanese).toBe(true);

          // Should not contain English-only keywords
          expect(prompt).not.toContain('You are a helpful');
        } else {
          // Check for English-specific keywords
          const englishKeywords = ['You are', 'ROLE:', 'TONE REQUIREMENTS'];
          const hasEnglish = englishKeywords.some(keyword =>
            prompt.includes(keyword)
          );
          expect(hasEnglish).toBe(true);

          // Should not contain Japanese-only keywords
          expect(prompt).not.toContain('あなたは');
        }
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property 16: Japanese Polite Form
   * Validates: Requirements 8.3
   * 
   * For any system prompt context in Japanese, the prompt SHALL use polite form
   * markers (です, ます) and SHALL NOT use casual form.
   */
  it('Property 16: Japanese Polite Form - Feature: nova-ai-recommendations', () => {
    fc.assert(
      fc.property(
        systemPromptContextArbitrary().filter(ctx => ctx.language === Language.JAPANESE),
        (context) => {
          const prompt = generateJapaneseSystemPrompt(context);

          // Check for polite form markers
          const politeFormMarkers = ['です', 'ます', 'ください'];
          const hasPoliteForm = politeFormMarkers.some(marker =>
            prompt.includes(marker)
          );
          expect(hasPoliteForm).toBe(true);

          // Check that the prompt explicitly mentions polite form requirement
          expect(prompt).toContain('です・ます調');

          // Check for casual form markers (should not be present)
          const casualFormMarkers = ['だ。', 'である。', 'する。'];
          for (const marker of casualFormMarkers) {
            expect(prompt).not.toContain(marker);
          }
        }
      ),
      PBT_CONFIG
    );
  });
});

describe('System Prompt Context Validation', () => {
  it('should include all required context fields in Japanese prompt', () => {
    const context: SystemPromptContext = {
      ageRange: AgeRange.TODDLER,
      geographicArea: 'Tokyo, JP',
      diseaseNames: ['RSV', 'Influenza'],
      riskLevel: RiskLevel.HIGH,
      language: Language.JAPANESE
    };

    const prompt = generateJapaneseSystemPrompt(context);

    // Check all context fields are present
    expect(prompt).toContain(context.ageRange);
    expect(prompt).toContain(context.geographicArea);
    expect(prompt).toContain('RSV');
    expect(prompt).toContain('Influenza');
    expect(prompt).toContain(context.riskLevel);
  });

  it('should include all required context fields in English prompt', () => {
    const context: SystemPromptContext = {
      ageRange: AgeRange.PRESCHOOL,
      geographicArea: 'California, US',
      diseaseNames: ['Norovirus', 'COVID-19'],
      riskLevel: RiskLevel.MEDIUM,
      language: Language.ENGLISH
    };

    const prompt = generateEnglishSystemPrompt(context);

    // Check all context fields are present
    expect(prompt).toContain(context.ageRange);
    expect(prompt).toContain(context.geographicArea);
    expect(prompt).toContain('Norovirus');
    expect(prompt).toContain('COVID-19');
    expect(prompt).toContain(context.riskLevel);
  });

  it('should include JSON format instruction in both languages', () => {
    const japaneseContext: SystemPromptContext = {
      ageRange: AgeRange.INFANT,
      geographicArea: 'Osaka, JP',
      diseaseNames: ['RSV'],
      riskLevel: RiskLevel.HIGH,
      language: Language.JAPANESE
    };

    const englishContext: SystemPromptContext = {
      ...japaneseContext,
      geographicArea: 'New York, US',
      language: Language.ENGLISH
    };

    const japanesePrompt = generateJapaneseSystemPrompt(japaneseContext);
    const englishPrompt = generateEnglishSystemPrompt(englishContext);

    // Check JSON format instructions
    expect(japanesePrompt).toContain('JSON');
    expect(japanesePrompt).toContain('summary');
    expect(japanesePrompt).toContain('actionItems');

    expect(englishPrompt).toContain('JSON');
    expect(englishPrompt).toContain('summary');
    expect(englishPrompt).toContain('actionItems');
  });
});
