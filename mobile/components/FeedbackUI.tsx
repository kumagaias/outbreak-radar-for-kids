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
    marginTop: 12,
    padding: 8,
    backgroundColor: '#fafafa',
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  questionText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#888',
    marginBottom: 6,
    textAlign: 'center'
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 6
  },
  button: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 3,
    minWidth: 50,
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
    fontSize: 11,
    fontWeight: '500'
  },
  thankYouText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '400'
  }
});
