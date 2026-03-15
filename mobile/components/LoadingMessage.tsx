import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { RiskIndicator, type RiskLevel } from "./RiskIndicator";

interface LoadingMessageProps {
  riskLevel: RiskLevel;
  message: string;
}

export function LoadingMessage({ riskLevel, message }: LoadingMessageProps) {
  return (
    <View style={styles.container}>
      <RiskIndicator level={riskLevel} />
      <View style={styles.messageContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginLeft: 12,
  },
});
