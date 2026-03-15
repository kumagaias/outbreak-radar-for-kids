/**
 * Feedback Collector for AI Recommendations
 * Collects user feedback on recommendation usefulness for prompt improvement
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RiskLevel, AgeRange, Language } from './types';

export interface FeedbackData {
  id: string;
  recommendationId: string;
  helpful: boolean;
  reason?: 'too-vague' | 'not-relevant' | 'too-alarming' | 'other';
  timestamp: number;
  // Anonymized context (no PII)
  riskLevel: RiskLevel;
  ageRange: AgeRange;
  language: Language;
  source: 'nova-lite' | 'nova-micro' | 'fallback';
}

export class FeedbackCollector {
  private readonly MAX_FEEDBACK_ITEMS = 100;
  private readonly FEEDBACK_RETENTION_DAYS = 30;
  private readonly STORAGE_KEY = 'feedback_data';
  private readonly CONSENT_KEY = 'feedback_consent';

  /**
   * Save feedback to local storage
   * **Validates: Requirements 12.1, 12.2, 12.3**
   */
  async saveFeedback(
    recommendationId: string,
    helpful: boolean,
    riskLevel: RiskLevel,
    ageRange: AgeRange,
    language: Language,
    source: 'nova-lite' | 'nova-micro' | 'fallback',
    reason?: 'too-vague' | 'not-relevant' | 'too-alarming' | 'other'
  ): Promise<void> {
    const feedback: FeedbackData = {
      id: this.generateUUID(),
      recommendationId,
      helpful,
      reason,
      timestamp: Date.now(),
      // Anonymized context - no PII
      riskLevel,
      ageRange,
      language,
      source
    };

    await this.appendToLocalStorage(feedback);

    // Optional: Send to server if user opted in
    if (await this.hasUserConsent()) {
      await this.sendAnonymizedFeedback(feedback);
    }
  }

  /**
   * Check if user has consented to feedback transmission
   * **Validates: Requirements 12.4, 12.5**
   */
  async hasUserConsent(): Promise<boolean> {
    try {
      const consent = await AsyncStorage.getItem(this.CONSENT_KEY);
      return consent === 'true';
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Request user consent for feedback transmission
   * **Validates: Requirements 12.5**
   */
  async requestConsent(): Promise<boolean> {
    // This method should be called from UI component
    // For now, it just returns the current consent status
    return await this.hasUserConsent();
  }

  /**
   * Set user consent for feedback transmission
   */
  async setConsent(consent: boolean): Promise<void> {
    await AsyncStorage.setItem(this.CONSENT_KEY, consent.toString());
  }

  /**
   * Send anonymized feedback to server (optional)
   * **Validates: Requirements 12.4, 12.6**
   */
  async sendAnonymizedFeedback(feedback: FeedbackData): Promise<void> {
    try {
      // Ensure no PII in feedback data
      const anonymizedFeedback = {
        id: feedback.id,
        recommendationId: feedback.recommendationId,
        helpful: feedback.helpful,
        reason: feedback.reason,
        timestamp: feedback.timestamp,
        riskLevel: feedback.riskLevel,
        ageRange: feedback.ageRange,
        language: feedback.language,
        source: feedback.source
      };

      // TODO: Implement server transmission when backend endpoint is ready
      console.log('Anonymized feedback ready for transmission:', anonymizedFeedback);
    } catch (error) {
      console.error('Error sending feedback:', error);
      // Fail silently - feedback is already saved locally
    }
  }

  /**
   * Append feedback to local storage with pruning
   * **Validates: Requirements 12.3, 12.4**
   */
  private async appendToLocalStorage(feedback: FeedbackData): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(this.STORAGE_KEY);
      const feedbackList: FeedbackData[] = existing ? JSON.parse(existing) : [];

      // Add new feedback
      feedbackList.push(feedback);

      // Prune old feedback (> 30 days or > 100 items)
      const cutoffTime = Date.now() - (this.FEEDBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const pruned = feedbackList
        .filter(f => f.timestamp > cutoffTime)
        .slice(-this.MAX_FEEDBACK_ITEMS);

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(pruned));
    } catch (error) {
      console.error('Error saving feedback to storage:', error);
      throw error;
    }
  }

  /**
   * Get all feedback from local storage
   */
  async getAllFeedback(): Promise<FeedbackData[]> {
    try {
      const existing = await AsyncStorage.getItem(this.STORAGE_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
      console.error('Error reading feedback from storage:', error);
      return [];
    }
  }

  /**
   * Clear all feedback from local storage
   */
  async clearAllFeedback(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing feedback:', error);
      throw error;
    }
  }

  /**
   * Generate UUID for feedback ID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
