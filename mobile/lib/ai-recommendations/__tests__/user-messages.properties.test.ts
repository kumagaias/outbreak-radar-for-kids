/**
 * Property-based tests for user-facing error messages
 * 
 * Property 21: Non-Alarming Error Messages
 * **Validates: Requirements 7.4**
 * 
 * For any error condition, the system SHALL NOT display error messages 
 * containing alarming terms like "failed", "error", "broken", or "unavailable" 
 * to the user.
 */

import fc from 'fast-check';
import { USER_ERROR_MESSAGES, formatUserMessage, UserMessage } from '../user-messages';

const PBT_CONFIG = {
  numRuns: 100,
  timeout: 10000,
  verbose: true
};

// Alarmist terms that should never appear in user-facing messages
const ALARMIST_TERMS_EN = [
  'failed',
  'failure',
  'error',
  'broken',
  'unavailable',
  'critical',
  'severe',
  'danger',
  'dangerous',
  'emergency',
  'urgent',
  'panic',
  'crisis',
  'fatal',
  'catastrophic',
  'disaster'
];

const ALARMIST_TERMS_JA = [
  '失敗',
  'エラー',
  '問題',
  '利用できません',
  '重大',
  '深刻',
  '危険',
  '緊急',
  '至急',
  'パニック',
  '危機',
  '致命的',
  '壊れ'
];

describe('Property 21: Non-Alarming Error Messages - Feature: nova-ai-recommendations', () => {
  it('should never contain alarmist terms in English messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          USER_ERROR_MESSAGES.GENERAL_ERROR,
          USER_ERROR_MESSAGES.STALE_DATA,
          USER_ERROR_MESSAGES.NO_OUTBREAK_DATA
        ),
        (message: UserMessage) => {
          const englishText = message.en.toLowerCase();
          
          for (const term of ALARMIST_TERMS_EN) {
            expect(englishText).not.toContain(term);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('should never contain alarmist terms in Japanese messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          USER_ERROR_MESSAGES.GENERAL_ERROR,
          USER_ERROR_MESSAGES.STALE_DATA,
          USER_ERROR_MESSAGES.NO_OUTBREAK_DATA
        ),
        (message: UserMessage) => {
          const japaneseText = message.ja;
          
          for (const term of ALARMIST_TERMS_JA) {
            expect(japaneseText).not.toContain(term);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('should maintain non-alarmist tone after formatting with parameters', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ja' as const, 'en' as const),
        fc.integer({ min: 1, max: 72 }), // hours parameter
        (language, hours) => {
          const formatted = formatUserMessage(
            USER_ERROR_MESSAGES.STALE_DATA,
            language,
            { hours: hours.toString() }
          );
          
          const lowerText = formatted.toLowerCase();
          const alarmistTerms = language === 'en' ? ALARMIST_TERMS_EN : ALARMIST_TERMS_JA;
          
          for (const term of alarmistTerms) {
            expect(lowerText).not.toContain(term.toLowerCase());
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('should have both language versions for all error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          USER_ERROR_MESSAGES.GENERAL_ERROR,
          USER_ERROR_MESSAGES.STALE_DATA,
          USER_ERROR_MESSAGES.NO_OUTBREAK_DATA
        ),
        (message: UserMessage) => {
          expect(message.ja).toBeDefined();
          expect(message.en).toBeDefined();
          expect(message.ja.length).toBeGreaterThan(0);
          expect(message.en.length).toBeGreaterThan(0);
        }
      ),
      PBT_CONFIG
    );
  });

  it('should use positive or neutral language instead of negative', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          USER_ERROR_MESSAGES.GENERAL_ERROR,
          USER_ERROR_MESSAGES.STALE_DATA,
          USER_ERROR_MESSAGES.NO_OUTBREAK_DATA
        ),
        fc.constantFrom('ja' as const, 'en' as const),
        (message: UserMessage, language) => {
          const text = message[language];
          
          // Messages should be informative, not alarming
          // They should guide users on what to do, not scare them
          expect(text.length).toBeGreaterThan(10); // Should be informative
          
          // Should not use exclamation marks excessively (max 1)
          const exclamationCount = (text.match(/!/g) || []).length;
          expect(exclamationCount).toBeLessThanOrEqual(1);
        }
      ),
      PBT_CONFIG
    );
  });

  it('should provide actionable guidance or context', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('ja' as const, 'en' as const),
        (language) => {
          // GENERAL_ERROR should indicate what's happening
          const generalError = USER_ERROR_MESSAGES.GENERAL_ERROR[language];
          expect(generalError.length).toBeGreaterThan(20);
          
          // NO_OUTBREAK_DATA should provide guidance
          const noData = USER_ERROR_MESSAGES.NO_OUTBREAK_DATA[language];
          expect(noData.length).toBeGreaterThan(30);
          
          // Messages should be helpful, not just stating a problem
          if (language === 'en') {
            expect(
              generalError.toLowerCase().includes('generat') ||
              generalError.toLowerCase().includes('wait') ||
              generalError.toLowerCase().includes('moment')
            ).toBe(true);
          } else {
            expect(
              generalError.includes('生成') ||
              generalError.includes('お待ち')
            ).toBe(true);
          }
        }
      ),
      PBT_CONFIG
    );
  });

  it('should not use all caps (which implies shouting)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          USER_ERROR_MESSAGES.GENERAL_ERROR,
          USER_ERROR_MESSAGES.STALE_DATA,
          USER_ERROR_MESSAGES.NO_OUTBREAK_DATA
        ),
        fc.constantFrom('ja' as const, 'en' as const),
        (message: UserMessage, language) => {
          const text = message[language];
          
          // Check that the message is not all uppercase (excluding acronyms)
          const words = text.split(/\s+/);
          const allCapsWords = words.filter(word => 
            word.length > 3 && word === word.toUpperCase() && /[A-Z]/.test(word)
          );
          
          // Should not have more than 1 all-caps word (allowing for acronyms)
          expect(allCapsWords.length).toBeLessThanOrEqual(1);
        }
      ),
      PBT_CONFIG
    );
  });
});
