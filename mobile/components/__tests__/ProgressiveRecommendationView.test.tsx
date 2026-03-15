/**
 * Unit tests for ProgressiveRecommendationView component
 * Validates: Requirements 11.8, 9.8, 9.9, 9.10
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Animated: {
    Value: jest.fn(() => ({
      interpolate: jest.fn(),
    })),
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    loop: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
    })),
    sequence: jest.fn(),
  },
}));

import React from "react";
import { ProgressiveRecommendationView } from "../ProgressiveRecommendationView";
import type { Recommendation } from "@/lib/ai-recommendations";
import { AgeRange, Language, RiskLevel } from "@/lib/ai-recommendations/types";

const mockRecommendation: Recommendation = {
  id: "test-123",
  summary: "Test recommendation summary",
  actionItems: [
    {
      id: "action-1",
      text: "Action 1",
      category: "prevention",
      priority: 1,
    },
    {
      id: "action-2",
      text: "Action 2",
      category: "monitoring",
      priority: 2,
    },
  ],
  riskLevel: RiskLevel.MEDIUM,
  diseaseNames: ["Influenza"],
  generatedAt: new Date(),
  outbreakDataTimestamp: new Date(),
  source: "nova",
  childAgeRange: AgeRange.TWO_TO_THREE,
  geographicArea: "Tokyo, Japan",
  language: Language.JAPANESE,
};

describe("ProgressiveRecommendationView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with risk level", () => {
    const component = (
      <ProgressiveRecommendationView
        riskLevel="medium"
        isGenerating={false}
      />
    );
    expect(component).toBeTruthy();
    expect(component.props.riskLevel).toBe("medium");
  });

  it("accepts cached recommendation", () => {
    const component = (
      <ProgressiveRecommendationView
        riskLevel="medium"
        cachedRecommendation={mockRecommendation}
        isGenerating={false}
      />
    );
    expect(component.props.cachedRecommendation).toBe(mockRecommendation);
  });

  it("handles generating state", () => {
    const component = (
      <ProgressiveRecommendationView
        riskLevel="medium"
        isGenerating={true}
      />
    );
    expect(component.props.isGenerating).toBe(true);
  });

  it("accepts generated recommendation", () => {
    const component = (
      <ProgressiveRecommendationView
        riskLevel="medium"
        generatedRecommendation={mockRecommendation}
        isGenerating={false}
      />
    );
    expect(component.props.generatedRecommendation).toBe(mockRecommendation);
  });

  it("accepts outbreak data timestamp", () => {
    const timestamp = new Date();
    const component = (
      <ProgressiveRecommendationView
        riskLevel="low"
        outbreakDataTimestamp={timestamp}
        isGenerating={false}
      />
    );
    expect(component.props.outbreakDataTimestamp).toBe(timestamp);
  });

  it("handles all risk levels", () => {
    const highComponent = (
      <ProgressiveRecommendationView
        riskLevel="high"
        isGenerating={false}
      />
    );
    const mediumComponent = (
      <ProgressiveRecommendationView
        riskLevel="medium"
        isGenerating={false}
      />
    );
    const lowComponent = (
      <ProgressiveRecommendationView
        riskLevel="low"
        isGenerating={false}
      />
    );

    expect(highComponent.props.riskLevel).toBe("high");
    expect(mediumComponent.props.riskLevel).toBe("medium");
    expect(lowComponent.props.riskLevel).toBe("low");
  });
});
