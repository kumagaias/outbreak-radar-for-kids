import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Colors } from "@/constants/colors";

interface RecommendationLoadingStateProps {
  message?: string;
}

/**
 * Progressive Disclosure Loading State
 * 
 * Displays animated loading indicator while AI generates recommendations.
 * Part of progressive disclosure UI pattern:
 * 1. Risk level indicator (1s) - local calculation
 * 2. Cached recommendations (3s) - if available
 * 3. Loading animation (3-5s) - if generation in progress
 * 4. AI recommendations (5s) - when ready
 * 5. Fallback (>5s) - if timeout
 * 
 * Requirements: 11.8, 9.8, 9.9, 9.10
 */
export function RecommendationLoadingState({
  message = "AI generating recommendations...",
}: RecommendationLoadingStateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pulse animation loop
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [fadeAnim, pulseAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.spinner,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={styles.spinnerInner} />
      </Animated.View>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  spinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  spinnerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    opacity: 0.3,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
