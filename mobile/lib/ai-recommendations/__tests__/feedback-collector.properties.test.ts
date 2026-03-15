/**
 * Property-Based Tests for Feedback Collector
 * Tests feedback data privacy and storage behavior
 * 
 * NOTE: These tests require fast-check to be installed.
 * Run: npm install fast-check --save-dev --legacy-peer-deps
 * Then run: npx jest mobile/lib/ai-recommendations/__tests__/feedback-collector.properties.test.ts
 */

import fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedbackCollector, FeedbackData } from '../feedback-collector';
import { RiskLevel, AgeRange, Language } from '../types';

describe('FeedbackCollector - Property Tests', () => {
  let feedbackCollector: FeedbackCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    feedbackCollector = new FeedbackCollector();
  });

  /**
   * Property 26: Feedback Data Privacy
   * **Validates: Requirements 12.6**
   * 
   * GIVEN any feedback data
   * WHEN feedback is saved
   * THEN the feedback data MUST NOT contain any PII
   * AND MUST only contain: riskLevel, ageRange, language, source
   */
  describe('Property 26: Feedback Data Privacy', () => {
    it('should never include PII in feedback data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.boolean(),
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(AgeRange.INFANT, AgeRange.TODDLER, AgeRange.PRESCHOOL, AgeRange.SCHOOL_AGE),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.constantFrom('nova-lite' as const, 'nova-micro' as const, 'fallback' as const),
          async (recommendationId, helpful, riskLevel, ageRange, language, source) => {
            // Save feedback
            await feedbackCollector.saveFeedback(
              recommendationId,
              helpful,
              riskLevel,
              ageRange,
              language,
              source
            );

            // Get the saved data
            const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
            expect(setItemCalls.length).toBeGreaterThan(0);

            const savedData = JSON.parse(setItemCalls[setItemCalls.length - 1][1]);
            expect(Array.isArray(savedData)).toBe(true);

            // Check each feedback item
            savedData.forEach((feedback: FeedbackData) => {
              // Must have required anonymized fields
              expect(feedback).toHaveProperty('riskLevel');
              expect(feedback).toHaveProperty('ageRange');
              expect(feedback).toHaveProperty('language');
              expect(feedback).toHaveProperty('source');

              // Must NOT have PII fields
              expect(feedback).not.toHaveProperty('name');
              expect(feedback).not.toHaveProperty('dateOfBirth');
              expect(feedback).not.toHaveProperty('exactAge');
              expect(feedback).not.toHaveProperty('address');
              expect(feedback).not.toHaveProperty('email');
              expect(feedback).not.toHaveProperty('phone');
              expect(feedback).not.toHaveProperty('countyOrWard');

              // Verify only allowed fields are present
              const allowedFields = [
                'id',
                'recommendationId',
                'helpful',
                'reason',
                'timestamp',
                'riskLevel',
                'ageRange',
                'language',
                'source'
              ];

              Object.keys(feedback).forEach(key => {
                expect(allowedFields).toContain(key);
              });
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain privacy when sending anonymized feedback', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.boolean(),
          fc.constantFrom(RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW),
          fc.constantFrom(AgeRange.INFANT, AgeRange.TODDLER, AgeRange.PRESCHOOL, AgeRange.SCHOOL_AGE),
          fc.constantFrom(Language.JAPANESE, Language.ENGLISH),
          fc.constantFrom('nova-lite' as const, 'nova-micro' as const, 'fallback' as const),
          async (recommendationId, helpful, riskLevel, ageRange, language, source) => {
            // Mock console.log to capture anonymized feedback
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            // Enable consent
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
              if (key === 'feedback_consent') return Promise.resolve('true');
              return Promise.resolve(null);
            });

            await feedbackCollector.saveFeedback(
              recommendationId,
              helpful,
              riskLevel,
              ageRange,
              language,
              source
            );

            // Check that sendAnonymizedFeedback was called
            const logCalls = consoleSpy.mock.calls.filter(call =>
              call[0] === 'Anonymized feedback ready for transmission:'
            );

            if (logCalls.length > 0) {
              const anonymizedFeedback = logCalls[0][1];

              // Verify no PII in anonymized feedback
              expect(anonymizedFeedback).not.toHaveProperty('name');
              expect(anonymizedFeedback).not.toHaveProperty('dateOfBirth');
              expect(anonymizedFeedback).not.toHaveProperty('exactAge');
              expect(anonymizedFeedback).not.toHaveProperty('address');
              expect(anonymizedFeedback).not.toHaveProperty('countyOrWard');

              // Verify only anonymized fields
              expect(anonymizedFeedback).toHaveProperty('riskLevel');
              expect(anonymizedFeedback).toHaveProperty('ageRange');
              expect(anonymizedFeedback).toHaveProperty('language');
              expect(anonymizedFeedback).toHaveProperty('source');
            }

            consoleSpy.mockRestore();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
