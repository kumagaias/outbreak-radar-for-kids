import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { RiskIndicator, RiskLevel } from "./RiskIndicator";
import { RecommendationContent } from "./RecommendationContent";
import { RecommendationLoadingState } from "./RecommendationLoadingState";
import type { Recommendation } from "@/lib/ai-recommendations";

interface ProgressiveRecommendationViewProps {
  riskLevel: RiskLevel;
  cachedRecommendation?: Recommendation;
  isGenerating: boolean;
  generatedRecommendation?: Recommendation;
  outbreakDataTimestamp?: Date;
}

/**
 * Progressive Disclosure UI Pattern
 * 
 * Displays content progressively to optimize perceived performance:
 * 
 * Timeline:
 * - 0-1s: Display risk level indicator (local calculation)
 * - 1-3s: Display cached recommendations if available
 * - 3-5s: Display loading animation if generation in progress
 * - 5s+: Display AI recommendations when ready, or fallback if timeout
 * 
 * This pattern ensures users always see something useful within 1 second,
 * even if AI generation takes longer.
 * 
 * Requirements: 11.8, 9.8, 9.9, 9.10
 * Design: Section "Progressive Disclosure UI Pattern"
 */
export function ProgressiveRecommendationView({
  riskLevel,
  cachedRecommendation,
  isGenerating,
  generatedRecommendation,
  outbreakDataTimestamp,
}: ProgressiveRecommendationViewProps) {
  const [showRiskIndicator, setShowRiskIndicator] = useState(false);
  const [showCachedContent, setShowCachedContent] = useState(false);
  const [showLoadingState, setShowLoadingState] = useState(false);

  useEffect(() => {
    // Phase 1: Show risk indicator immediately (within 1s)
    const riskTimer = setTimeout(() => {
      setShowRiskIndicator(true);
    }, 100);

    // Phase 2: Show cached content after 1s if available
    const cachedTimer = setTimeout(() => {
      if (cachedRecommendation) {
        setShowCachedContent(true);
      }
    }, 1000);

    // Phase 3: Show loading state after 3s if still generating
    const loadingTimer = setTimeout(() => {
      if (isGenerating && !generatedRecommendation) {
        setShowLoadingState(true);
      }
    }, 3000);

    return () => {
      clearTimeout(riskTimer);
      clearTimeout(cachedTimer);
      clearTimeout(loadingTimer);
    };
  }, [cachedRecommendation, isGenerating, generatedRecommendation]);

  // Phase 4: Show generated recommendation when ready
  const displayRecommendation = generatedRecommendation || cachedRecommendation;

  return (
    <View style={styles.container}>
      {/* Phase 1: Risk Indicator (always shown first) */}
      {showRiskIndicator && (
        <View style={styles.riskSection}>
          <RiskIndicator level={riskLevel} />
        </View>
      )}

      {/* Phase 2-4: Content based on state */}
      {displayRecommendation && !isGenerating ? (
        // Show recommendation content (cached or generated)
        <RecommendationContent
          recommendation={displayRecommendation}
          outbreakDataTimestamp={outbreakDataTimestamp}
        />
      ) : showLoadingState && isGenerating ? (
        // Show loading animation if generation takes >3s
        <RecommendationLoadingState />
      ) : showCachedContent && cachedRecommendation ? (
        // Show cached content while generating
        <RecommendationContent
          recommendation={cachedRecommendation}
          outbreakDataTimestamp={outbreakDataTimestamp}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  riskSection: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
