import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import type { Country } from "@/lib/mock-data";

interface MedicalDisclaimerProps {
  country: Country;
}

export function MedicalDisclaimer({ country }: MedicalDisclaimerProps) {
  const disclaimerText =
    country === "JP"
      ? "このアプリは医療機器ではありません。情報提供のみを目的としています。医療上の懸念がある場合は、医療機関にご相談ください。"
      : "This app is not a medical device. It is for informational purposes only. Please consult a healthcare provider for medical concerns.";

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>ℹ️</Text>
      </View>
      <Text style={styles.text}>{disclaimerText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSecondary,
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
});
