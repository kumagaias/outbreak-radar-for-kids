import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Colors } from "@/constants/colors";

export type RiskLevel = "high" | "medium" | "low";

interface RiskIndicatorProps {
  level: RiskLevel;
}

export function RiskIndicator({ level }: RiskIndicatorProps) {
  const getIndicatorColor = () => {
    switch (level) {
      case "high":
        return Colors.danger;
      case "medium":
        return Colors.warning;
      case "low":
        return Colors.success;
    }
  };

  const getTitle = () => {
    switch (level) {
      case "high":
        return "要注意";
      case "medium":
        return "注意";
      case "low":
        return "安心";
    }
  };

  const getFaceIcon = () => {
    const color = getIndicatorColor();
    
    switch (level) {
      case "high":
        // Worried face
        return (
          <Svg width="64" height="64" viewBox="0 0 64 64">
            <Circle cx="32" cy="32" r="30" fill={color} />
            {/* Eyes */}
            <Circle cx="22" cy="26" r="3" fill="#fff" />
            <Circle cx="42" cy="26" r="3" fill="#fff" />
            {/* Worried mouth */}
            <Path
              d="M 20 42 Q 32 36 44 42"
              stroke="#fff"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        );
      case "medium":
        // Neutral face
        return (
          <Svg width="64" height="64" viewBox="0 0 64 64">
            <Circle cx="32" cy="32" r="30" fill={color} />
            {/* Eyes */}
            <Circle cx="22" cy="26" r="3" fill="#fff" />
            <Circle cx="42" cy="26" r="3" fill="#fff" />
            {/* Neutral mouth */}
            <Path
              d="M 20 40 L 44 40"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </Svg>
        );
      case "low":
        // Happy face
        return (
          <Svg width="64" height="64" viewBox="0 0 64 64">
            <Circle cx="32" cy="32" r="30" fill={color} />
            {/* Eyes */}
            <Circle cx="22" cy="26" r="3" fill="#fff" />
            <Circle cx="42" cy="26" r="3" fill="#fff" />
            {/* Smile */}
            <Path
              d="M 20 38 Q 32 46 44 38"
              stroke="#fff"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getTitle()}</Text>
      <View style={styles.indicator}>
        {getFaceIcon()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 12,
  },
  indicator: {
    alignItems: "center",
    justifyContent: "center",
  },
});
