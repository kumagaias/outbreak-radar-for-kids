/**
 * Unit Tests for Feedback Collector
 * Tests feedback storage, pruning, and privacy
 * **Validates: Requirements 12.3, 12.4, 12.5, 12.6**
 */

import { FeedbackCollector, FeedbackData } from '../feedback-collector';
import { RiskLevel, AgeRange, Language } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('FeedbackCollector', () => {
  let feedbackCollector: FeedbackCollector;

  beforeEach(() => {
    feedbackCollector = new FeedbackCollector();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('saveFeedback', () => {
    /**
     * Test feedback is saved to AsyncStorage
     * **Validates: Requirements 12.3**
     */
    it('should save feedback to AsyncStorage', async () => {
      await feedbackCollector.saveFeedback(
        'rec-123',
        true,
        RiskLevel.HIGH,
        AgeRange.TODDLER,
        Language.JAPANESE,
        'nova-lite'
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'feedback_data',
        expect.any(String)
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        recommendationId: 'rec-123',
        helpful: true,
        riskLevel: RiskLevel.HIGH,
        ageRange: AgeRange.TODDLER,
        language: Language.JAPANESE,
        source: 'nova-lite'
      });
    });

    /**
     * Test no PII in feedback data
     * **Validates: Requirements 12.6**
     */
    it('should not include PII in feedback data', async () => {
      await feedbackCollector.saveFeedback(
        'rec-456',
        false,
        RiskLevel.MEDIUM,
        AgeRange.INFANT,
        Language.ENGLISH,
        'nova-micro'
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      const feedback = savedData[0];

      // Should not have PII fields
      expect(feedback).not.toHaveProperty('name');
      expect(feedback).not.toHaveProperty('dateOfBirth');
      expect(feedback).not.toHaveProperty('exactAge');
      expect(feedback).not.toHaveProperty('address');
      expect(feedback).not.toHaveProperty('email');
      expect(feedback).not.toHaveProperty('phone');
      expect(feedback).not.toHaveProperty('countyOrWard');

      // Should only have anonymized fields
      expect(feedback).toHaveProperty('id');
      expect(feedback).toHaveProperty('recommendationId');
      expect(feedback).toHaveProperty('helpful');
      expect(feedback).toHaveProperty('timestamp');
      expect(feedback).toHaveProperty('riskLevel');
      expect(feedback).toHaveProperty('ageRange');
      expect(feedback).toHaveProperty('language');
      expect(feedback).toHaveProperty('source');
    });
  });

  describe('feedback pruning', () => {
    /**
     * Test feedback pruning after 30 days
     * **Validates: Requirements 12.4**
     */
    it('should prune feedback older than 30 days', async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - (31 * 24 * 60 * 60 * 1000);
      const twentyNineDaysAgo = now - (29 * 24 * 60 * 60 * 1000);

      const existingFeedback: FeedbackData[] = [
        {
          id: 'old-1',
          recommendationId: 'rec-old',
          helpful: true,
          timestamp: thirtyOneDaysAgo,
          riskLevel: RiskLevel.LOW,
          ageRange: AgeRange.PRESCHOOL,
          language: Language.JAPANESE,
          source: 'fallback'
        },
        {
          id: 'recent-1',
          recommendationId: 'rec-recent',
          helpful: false,
          timestamp: twentyNineDaysAgo,
          riskLevel: RiskLevel.MEDIUM,
          ageRange: AgeRange.TODDLER,
          language: Language.ENGLISH,
          source: 'nova-lite'
        }
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(existingFeedback)
      );

      await feedbackCollector.saveFeedback(
        'rec-new',
        true,
        RiskLevel.HIGH,
        AgeRange.INFANT,
        Language.JAPANESE,
        'nova-micro'
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      // Old feedback should be pruned
      expect(savedData).toHaveLength(2);
      expect(savedData.find((f: FeedbackData) => f.id === 'old-1')).toBeUndefined();
      expect(savedData.find((f: FeedbackData) => f.id === 'recent-1')).toBeDefined();
      expect(savedData.find((f: FeedbackData) => f.recommendationId === 'rec-new')).toBeDefined();
    });

    /**
     * Test feedback pruning after 100 items
     * **Validates: Requirements 12.4**
     */
    it('should prune feedback exceeding 100 items', async () => {
      const now = Date.now();
      // Create 100 items with decreasing timestamps (0 is oldest, 99 is newest)
      const existingFeedback: FeedbackData[] = Array.from({ length: 100 }, (_, i) => ({
        id: `feedback-${i}`,
        recommendationId: `rec-${i}`,
        helpful: i % 2 === 0,
        timestamp: now - ((99 - i) * 1000), // feedback-0 is oldest, feedback-99 is newest
        riskLevel: RiskLevel.MEDIUM,
        ageRange: AgeRange.TODDLER,
        language: Language.JAPANESE,
        source: 'nova-lite' as const
      }));

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(existingFeedback)
      );

      await feedbackCollector.saveFeedback(
        'rec-new',
        true,
        RiskLevel.HIGH,
        AgeRange.INFANT,
        Language.ENGLISH,
        'nova-micro'
      );

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      // Should keep only 100 most recent items
      expect(savedData).toHaveLength(100);
      
      // Oldest item (feedback-0) should be pruned
      expect(savedData.find((f: FeedbackData) => f.id === 'feedback-0')).toBeUndefined();
      
      // Newest item should be present
      expect(savedData.find((f: FeedbackData) => f.recommendationId === 'rec-new')).toBeDefined();
    });
  });

  describe('consent management', () => {
    /**
     * Test consent check before server transmission
     * **Validates: Requirements 12.5**
     */
    it('should check consent before sending feedback to server', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // No consent
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await feedbackCollector.saveFeedback(
        'rec-123',
        true,
        RiskLevel.HIGH,
        AgeRange.TODDLER,
        Language.JAPANESE,
        'nova-lite'
      );

      // Should not send to server
      expect(consoleSpy).not.toHaveBeenCalledWith(
        'Anonymized feedback ready for transmission:',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should send feedback to server when consent is given', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock consent
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'feedback_consent') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      await feedbackCollector.saveFeedback(
        'rec-456',
        false,
        RiskLevel.MEDIUM,
        AgeRange.INFANT,
        Language.ENGLISH,
        'nova-micro'
      );

      // Should send to server
      expect(consoleSpy).toHaveBeenCalledWith(
        'Anonymized feedback ready for transmission:',
        expect.objectContaining({
          recommendationId: 'rec-456',
          helpful: false,
          riskLevel: RiskLevel.MEDIUM,
          ageRange: AgeRange.INFANT,
          language: Language.ENGLISH,
          source: 'nova-micro'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should return false when hasUserConsent is called without consent', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const hasConsent = await feedbackCollector.hasUserConsent();

      expect(hasConsent).toBe(false);
    });

    it('should return true when hasUserConsent is called with consent', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

      const hasConsent = await feedbackCollector.hasUserConsent();

      expect(hasConsent).toBe(true);
    });
  });

  describe('getAllFeedback', () => {
    it('should return all feedback from storage', async () => {
      const mockFeedback: FeedbackData[] = [
        {
          id: 'feedback-1',
          recommendationId: 'rec-1',
          helpful: true,
          timestamp: Date.now(),
          riskLevel: RiskLevel.HIGH,
          ageRange: AgeRange.TODDLER,
          language: Language.JAPANESE,
          source: 'nova-lite'
        }
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(mockFeedback)
      );

      const feedback = await feedbackCollector.getAllFeedback();

      expect(feedback).toEqual(mockFeedback);
    });

    it('should return empty array when no feedback exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const feedback = await feedbackCollector.getAllFeedback();

      expect(feedback).toEqual([]);
    });
  });

  describe('clearAllFeedback', () => {
    it('should clear all feedback from storage', async () => {
      await feedbackCollector.clearAllFeedback();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('feedback_data');
    });
  });
});
