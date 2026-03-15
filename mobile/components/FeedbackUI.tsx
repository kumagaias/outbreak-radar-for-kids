/**
 * Feedback UI Component
 * Displays "Was this information helpful?" question with Yes/No buttons
 * **Validates: Requirements 12.1, 12.2**
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FeedbackCollector } from '../lib/ai-recommendations/feedback-collector';
import { RiskLevel, AgeRange, Language } from '../lib/ai-recommendations/types';

interface FeedbackUIProps {
  recommendationId: string;
  riskLevel: RiskLevel;
  ageRange: AgeRange;
  language: Language;
  source: 'nova-lite' | 'nova-micro' | 'fallback';
}

export const FeedbackUI: React.FC<FeedbackUIProps> = ({
  recommendationId,
  riskLevel,
  ageRange,
  language,
  source
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const feedbackCollector = new FeedbackCollector();

  const handleFeedback = async (helpful: boolean) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await feedbackCollector.saveFeedback(
        recommendationId,
        helpful,
        riskLevel,
        ageRange,
        language,
        source
      );
      setFeedbackGiven(true);
    } catch (error) {
      console.error('Error saving feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const questionText = language === Language.JAPANESE
    ? 'この情報は役に立ちましたか？'
    : 'Was this information helpful?';

  const thankYouText = language === Language.JAPANESE
    ? 'フィードバックありがとうございます'
    : 'Thank you for your feedback';

  const yesText = language === Language.JAPANESE ? 'はい' : 'Yes';
  const noText = language === Language.JAPANESE ? 'いいえ' : 'No';

  if (feedbackGiven) {
    return (
      <View style={styles.container}>
        <Text style={styles.thankYouText}>{thankYouText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>{questionText}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.yesButton]}
          onPress={() => handleFeedback(true)}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>{yesText}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.noButton]}
          onPress={() => handleFeedback(false)}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>{noText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  questionText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center'
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center'
  },
  yesButton: {
    backgroundColor: '#4CAF50'
  },
  noButton: {
    backgroundColor: '#9e9e9e'
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500'
  },
  thankYouText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '400'
  }
});
