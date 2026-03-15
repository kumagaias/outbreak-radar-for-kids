import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { Recommendation } from "@/lib/ai-recommendations";

interface RecommendationContentProps {
  recommendation: Recommendation;
}

export function RecommendationContent({
  recommendation,
}: RecommendationContentProps) {
  return (
    <View style={styles.container}>
      {/* Summary */}
      <Text style={styles.summary}>{recommendation.summary}</Text>

      {/* Action Items Checklist */}
      <View style={styles.actionsContainer}>
        {recommendation.actionItems.map((actionItem, index) => (
          <View key={index} style={styles.actionItem}>
            <View style={styles.checkbox}>
              <Text style={styles.checkboxText}>✓</Text>
            </View>
            <Text style={styles.actionText}>{actionItem.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Separate component for timestamp display at the bottom
export function DataTimestamp({
  outbreakDataTimestamp,
}: {
  outbreakDataTimestamp?: Date;
}) {
  if (!outbreakDataTimestamp) return null;

  const isStale =
    Date.now() - outbreakDataTimestamp.getTime() > 24 * 60 * 60 * 1000;

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString();
  };

  return (
    <View style={styles.timestampContainer}>
      <Text style={styles.timestampLabel}>
        {isStale ? "⚠️ " : ""}Data from:{" "}
      </Text>
      <Text style={styles.timestampValue}>
        {formatTimestamp(outbreakDataTimestamp)}
      </Text>
      {isStale && (
        <Text style={styles.staleWarning}>
          Data is more than 24 hours old
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
    marginBottom: 20,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  checkboxText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "600",
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  timestampContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  timestampLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timestampValue: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  staleWarning: {
    fontSize: 13,
    color: Colors.warning,
    marginTop: 8,
    fontWeight: "500",
  },
});
