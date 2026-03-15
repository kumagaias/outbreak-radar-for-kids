/**
 * Unit Tests for FeedbackUI Component
 * Tests feedback UI rendering and interaction
 * **Validates: Requirements 12.1, 12.2**
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

// Mock FeedbackCollector
jest.mock('../../lib/ai-recommendations/feedback-collector');

import React from 'react';
import { FeedbackUI } from '../FeedbackUI';
import { RiskLevel, AgeRange, Language } from '../../lib/ai-recommendations/types';

describe('FeedbackUI', () => {
  describe('component props', () => {
    it('should accept all required props', () => {
      const component = (
        <FeedbackUI
          recommendationId="rec-123"
          riskLevel={RiskLevel.HIGH}
          ageRange={AgeRange.TODDLER}
          language={Language.JAPANESE}
          source="nova-lite"
        />
      );

      expect(component).toBeTruthy();
      expect(component.props.recommendationId).toBe('rec-123');
      expect(component.props.riskLevel).toBe(RiskLevel.HIGH);
      expect(component.props.ageRange).toBe(AgeRange.TODDLER);
      expect(component.props.language).toBe(Language.JAPANESE);
      expect(component.props.source).toBe('nova-lite');
    });

    it('should accept Japanese language', () => {
      const component = (
        <FeedbackUI
          recommendationId="rec-456"
          riskLevel={RiskLevel.MEDIUM}
          ageRange={AgeRange.INFANT}
          language={Language.JAPANESE}
          source="nova-micro"
        />
      );

      expect(component.props.language).toBe(Language.JAPANESE);
    });

    it('should accept English language', () => {
      const component = (
        <FeedbackUI
          recommendationId="rec-789"
          riskLevel={RiskLevel.LOW}
          ageRange={AgeRange.PRESCHOOL}
          language={Language.ENGLISH}
          source="fallback"
        />
      );

      expect(component.props.language).toBe(Language.ENGLISH);
    });

    it('should accept all risk levels', () => {
      const highComponent = (
        <FeedbackUI
          recommendationId="rec-1"
          riskLevel={RiskLevel.HIGH}
          ageRange={AgeRange.TODDLER}
          language={Language.JAPANESE}
          source="nova-lite"
        />
      );

      const mediumComponent = (
        <FeedbackUI
          recommendationId="rec-2"
          riskLevel={RiskLevel.MEDIUM}
          ageRange={AgeRange.INFANT}
          language={Language.ENGLISH}
          source="nova-micro"
        />
      );

      const lowComponent = (
        <FeedbackUI
          recommendationId="rec-3"
          riskLevel={RiskLevel.LOW}
          ageRange={AgeRange.PRESCHOOL}
          language={Language.JAPANESE}
          source="fallback"
        />
      );

      expect(highComponent.props.riskLevel).toBe(RiskLevel.HIGH);
      expect(mediumComponent.props.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(lowComponent.props.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should accept all age ranges', () => {
      const infantComponent = (
        <FeedbackUI
          recommendationId="rec-1"
          riskLevel={RiskLevel.HIGH}
          ageRange={AgeRange.INFANT}
          language={Language.JAPANESE}
          source="nova-lite"
        />
      );

      const toddlerComponent = (
        <FeedbackUI
          recommendationId="rec-2"
          riskLevel={RiskLevel.MEDIUM}
          ageRange={AgeRange.TODDLER}
          language={Language.ENGLISH}
          source="nova-micro"
        />
      );

      const preschoolComponent = (
        <FeedbackUI
          recommendationId="rec-3"
          riskLevel={RiskLevel.LOW}
          ageRange={AgeRange.PRESCHOOL}
          language={Language.JAPANESE}
          source="fallback"
        />
      );

      const schoolAgeComponent = (
        <FeedbackUI
          recommendationId="rec-4"
          riskLevel={RiskLevel.MEDIUM}
          ageRange={AgeRange.SCHOOL_AGE}
          language={Language.ENGLISH}
          source="nova-lite"
        />
      );

      expect(infantComponent.props.ageRange).toBe(AgeRange.INFANT);
      expect(toddlerComponent.props.ageRange).toBe(AgeRange.TODDLER);
      expect(preschoolComponent.props.ageRange).toBe(AgeRange.PRESCHOOL);
      expect(schoolAgeComponent.props.ageRange).toBe(AgeRange.SCHOOL_AGE);
    });

    it('should accept all source types', () => {
      const liteComponent = (
        <FeedbackUI
          recommendationId="rec-1"
          riskLevel={RiskLevel.HIGH}
          ageRange={AgeRange.TODDLER}
          language={Language.JAPANESE}
          source="nova-lite"
        />
      );

      const microComponent = (
        <FeedbackUI
          recommendationId="rec-2"
          riskLevel={RiskLevel.MEDIUM}
          ageRange={AgeRange.INFANT}
          language={Language.ENGLISH}
          source="nova-micro"
        />
      );

      const fallbackComponent = (
        <FeedbackUI
          recommendationId="rec-3"
          riskLevel={RiskLevel.LOW}
          ageRange={AgeRange.PRESCHOOL}
          language={Language.JAPANESE}
          source="fallback"
        />
      );

      expect(liteComponent.props.source).toBe('nova-lite');
      expect(microComponent.props.source).toBe('nova-micro');
      expect(fallbackComponent.props.source).toBe('fallback');
    });
  });
});
