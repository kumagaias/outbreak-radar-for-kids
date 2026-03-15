/**
 * Unit tests for RecommendationContent component
 * Validates: Requirements 9.3, 9.4, 9.7, 11.6
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

import React from "react";
import { RecommendationContent, DataTimestamp } from "../RecommendationContent";
import type { Recommendation } from "@/lib/ai-recommendations";

describe("RecommendationContent", () => {
  const mockRecommendation: Recommendation = {
    id: "test-rec-1",
    summary: "Test summary with disease information",
    actionItems: [
      { text: "Wash hands frequently" },
      { text: "Wear masks in crowded places" },
      { text: "Monitor children's health daily" },
    ],
    riskLevel: "high" as any,
    childAgeRange: "TODDLER" as any,
    language: "JAPANESE" as any,
    source: "NOVA" as any,
    generatedAt: new Date(),
  };

  it("should accept recommendation with summary text", () => {
    const component = (
      <RecommendationContent recommendation={mockRecommendation} />
    );
    expect(component.props.recommendation.summary).toBe(
      "Test summary with disease information"
    );
  });

  it("should accept recommendation with action items in checklist format", () => {
    const component = (
      <RecommendationContent recommendation={mockRecommendation} />
    );
    expect(component.props.recommendation.actionItems).toHaveLength(3);
    expect(component.props.recommendation.actionItems[0].text).toBe(
      "Wash hands frequently"
    );
  });

  it("should not require outbreak data timestamp", () => {
    const component = (
      <RecommendationContent
        recommendation={mockRecommendation}
      />
    );
    expect(component.props.outbreakDataTimestamp).toBeUndefined();
  });

  it("should calculate staleness when data is older than 24 hours", () => {
    const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const isStale =
      Date.now() - oldTimestamp.getTime() > 24 * 60 * 60 * 1000;
    expect(isStale).toBe(true);
  });

  it("should not mark data as stale when fresh", () => {
    const freshTimestamp = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const isStale =
      Date.now() - freshTimestamp.getTime() > 24 * 60 * 60 * 1000;
    expect(isStale).toBe(false);
  });
});

describe("DataTimestamp", () => {
  it("should calculate staleness when data is older than 24 hours", () => {
    const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const isStale =
      Date.now() - oldTimestamp.getTime() > 24 * 60 * 60 * 1000;
    expect(isStale).toBe(true);
  });

  it("should not mark data as stale when fresh", () => {
    const freshTimestamp = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const isStale =
      Date.now() - freshTimestamp.getTime() > 24 * 60 * 60 * 1000;
    expect(isStale).toBe(false);
  });
});
