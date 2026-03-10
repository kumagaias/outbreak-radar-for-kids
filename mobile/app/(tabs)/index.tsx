import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useProfile } from "@/lib/profile-context";
import { t } from "@/lib/i18n";
import {
  DISEASES,
  getDiseaseName,
  getOutbreakDataForArea,
  getHighestRiskAreas,
} from "@/lib/mock-data";
import { generateRecommendations, type Recommendation } from "@/lib/ai-recommendations";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isLoading } = useProfile();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace("/onboarding");
    }
  }, [profile, isLoading]);

  useEffect(() => {
    if (profile) {
      loadRecommendations();
    }
  }, [profile]);

  const loadRecommendations = async () => {
    if (!profile) return;
    
    setLoadingRecommendation(true);
    try {
      const outbreakData = getOutbreakDataForArea(profile.area, profile.country);
      const childrenAges = profile.children?.map((c) => c.ageGroup) || [];
      
      const rec = await generateRecommendations({
        area: profile.area,
        country: profile.country,
        outbreaks: outbreakData,
        childrenAges,
      });
      
      setRecommendation(rec);
    } catch (error) {
      console.error("Failed to load recommendations:", error);
    } finally {
      setLoadingRecommendation(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!profile) {
    return null;
  }

  const strings = t(profile.country);
  const outbreakData = getOutbreakDataForArea(profile.area, profile.country);
  const highRiskAreas = getHighestRiskAreas(profile.country, 5);

  const getLevelColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return Colors.danger;
      case "medium":
        return Colors.warning;
      case "low":
        return Colors.success;
    }
  };

  const getLevelLabel = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "high":
        return strings.common.high;
      case "medium":
        return strings.common.medium;
      case "low":
        return strings.common.low;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Local Outbreak Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>
              {profile.country === "JP" 
                ? `${profile.area}の流行状況` 
                : `${profile.area} Outbreak Status`}
            </Text>
          </View>
          {outbreakData.length > 0 ? (
            <View style={styles.diseaseGrid}>
              {outbreakData.map((outbreak) => {
                const disease = DISEASES.find((d) => d.id === outbreak.diseaseId);
                if (!disease) return null;

                return (
                  <View key={outbreak.diseaseId} style={styles.diseaseCard}>
                    <View
                      style={[
                        styles.diseaseIcon,
                        { backgroundColor: disease.color + "20" },
                      ]}
                    >
                      <Ionicons
                        name={disease.icon as any}
                        size={24}
                        color={disease.color}
                      />
                    </View>
                    <Text style={styles.diseaseName}>
                      {getDiseaseName(disease, profile.country)}
                    </Text>
                    <View
                      style={[
                        styles.levelBadge,
                        { backgroundColor: getLevelColor(outbreak.level) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.levelText,
                          { color: getLevelColor(outbreak.level) },
                        ]}
                      >
                        {getLevelLabel(outbreak.level)}
                      </Text>
                    </View>
                    <Text style={styles.casesText}>{outbreak.cases}{strings.home.cases}</Text>
                    <View style={styles.changeContainer}>
                      <Ionicons
                        name={
                          outbreak.weeklyChange > 0
                            ? "trending-up"
                            : outbreak.weeklyChange < 0
                            ? "trending-down"
                            : "remove"
                        }
                        size={14}
                        color={
                          outbreak.weeklyChange > 0
                            ? Colors.danger
                            : outbreak.weeklyChange < 0
                            ? Colors.success
                            : Colors.textTertiary
                        }
                      />
                      <Text
                        style={[
                          styles.changeText,
                          {
                            color:
                              outbreak.weeklyChange > 0
                                ? Colors.danger
                                : outbreak.weeklyChange < 0
                                ? Colors.success
                                : Colors.textTertiary,
                          },
                        ]}
                      >
                        {outbreak.weeklyChange > 0 ? "+" : ""}
                        {outbreak.weeklyChange}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={Colors.success}
              />
              <Text style={styles.emptyText}>
                {strings.home.noOutbreaks}
              </Text>
            </View>
          )}
        </View>

        {/* AI Recommendations */}
        {recommendation && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>
                {profile.country === "JP" ? "おすすめの対策" : "Recommendations"}
              </Text>
            </View>
            
            {loadingRecommendation ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <View style={[
                styles.recommendationCard,
                recommendation.priority === "high" && styles.recommendationCardHigh,
              ]}>
                <View style={styles.recommendationHeader}>
                  <View style={[
                    styles.priorityBadge,
                    { backgroundColor: 
                      recommendation.priority === "high" ? Colors.danger + "20" :
                      recommendation.priority === "medium" ? Colors.warning + "20" :
                      Colors.success + "20"
                    }
                  ]}>
                    <Text style={[
                      styles.priorityText,
                      { color:
                        recommendation.priority === "high" ? Colors.danger :
                        recommendation.priority === "medium" ? Colors.warning :
                        Colors.success
                      }
                    ]}>
                      {recommendation.priority === "high" ? (profile.country === "JP" ? "高" : "High") :
                       recommendation.priority === "medium" ? (profile.country === "JP" ? "中" : "Med") :
                       (profile.country === "JP" ? "低" : "Low")}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.recommendationSummary}>
                  {recommendation.summary}
                </Text>
                
                <View style={styles.actionsList}>
                  {recommendation.actions.map((action, index) => (
                    <View key={index} style={styles.actionItem}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                      <Text style={styles.actionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* High Risk Areas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={20} color={Colors.danger} />
            <Text style={styles.sectionTitle}>{strings.home.highRiskAreas}</Text>
          </View>
          {highRiskAreas.map((outbreak, index) => {
            const disease = DISEASES.find((d) => d.id === outbreak.diseaseId);
            if (!disease) return null;

            return (
              <View key={`${outbreak.area}-${outbreak.diseaseId}`} style={styles.riskCard}>
                <View style={styles.riskRank}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>
                <View style={styles.riskInfo}>
                  <Text style={styles.riskArea}>{outbreak.area}</Text>
                  <Text style={styles.riskDisease}>
                    {getDiseaseName(disease, profile.country)}
                  </Text>
                </View>
                <View style={styles.riskStats}>
                  <Text style={styles.riskCases}>{outbreak.cases}{strings.home.cases}</Text>
                  <View
                    style={[
                      styles.levelBadgeSmall,
                      { backgroundColor: getLevelColor(outbreak.level) + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.levelTextSmall,
                        { color: getLevelColor(outbreak.level) },
                      ]}
                    >
                      {getLevelLabel(outbreak.level)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Children Summary */}
        {profile.children && profile.children.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{strings.home.children}</Text>
            </View>
            {profile.children.map((child) => (
              <View key={child.id} style={styles.childCard}>
                <Ionicons name="person" size={20} color={Colors.primary} />
                <Text style={styles.childName}>{child.name}</Text>
                <Text style={styles.childAge}>{child.ageGroup}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle" size={16} color={Colors.textTertiary} />
          <Text style={styles.disclaimerText}>{strings.disclaimer}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recommendationCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recommendationCardHigh: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  recommendationSummary: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 16,
  },
  actionsList: {
    gap: 12,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  diseaseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  diseaseCard: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  diseaseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  diseaseName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  levelText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  casesText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: "center",
  },
  riskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  riskRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  riskInfo: {
    flex: 1,
  },
  riskArea: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  riskDisease: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  riskStats: {
    alignItems: "flex-end",
  },
  riskCases: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 4,
  },
  levelBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelTextSmall: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  childCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  childName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  childAge: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginTop: 16,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});
