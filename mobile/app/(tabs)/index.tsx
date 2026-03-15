import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
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

// AI Recommendation Components
import { RiskIndicator, type RiskLevel as RiskIndicatorLevel } from '@/components/RiskIndicator';
import { RecommendationContent, DataTimestamp } from '@/components/RecommendationContent';
import { LoadingMessage } from '@/components/LoadingMessage';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { FeedbackUI } from '@/components/FeedbackUI';

// AI Recommendation Services
import {
  RiskAnalyzer,
  RecommendationGenerator,
  CacheManager,
  NovaService,
  RiskLevel,
  AgeRange,
  Language,
  type Recommendation,
  type OutbreakData,
  type ChildProfile,
} from '@/lib/ai-recommendations';

// Convert mock data to OutbreakData format
function convertMockToOutbreakData(mockData: any[]): OutbreakData[] {
  return mockData.map(outbreak => ({
    diseaseId: outbreak.diseaseId,
    diseaseName: outbreak.diseaseName || outbreak.diseaseId,
    diseaseNameLocal: outbreak.diseaseNameLocal,
    severity: outbreak.level === 'high' ? 8 : outbreak.level === 'medium' ? 5 : 2,
    geographicUnit: {
      country: (outbreak.country || 'JP') as 'JP' | 'US',
      stateOrPrefecture: outbreak.area || 'Tokyo',
    },
    affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER, AgeRange.PRESCHOOL],
    reportedCases: outbreak.cases || 0,
    timestamp: new Date(),
  }));
}

// Convert profile to ChildProfile format
function convertProfileToChildProfile(profile: any): ChildProfile {
  let ageRange = AgeRange.PRESCHOOL;
  if (profile.children && profile.children.length > 0) {
    const firstChild = profile.children[0];
    const ageGroup = firstChild.ageGroup;
    
    if (ageGroup === '0-1') ageRange = AgeRange.INFANT;
    else if (ageGroup === '2-3') ageRange = AgeRange.TODDLER;
    else if (ageGroup === '4-6') ageRange = AgeRange.PRESCHOOL;
    else ageRange = AgeRange.SCHOOL_AGE;
  }

  return {
    ageRange,
    location: {
      country: (profile.country || 'JP') as 'JP' | 'US',
      stateOrPrefecture: profile.area || 'Tokyo',
    },
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isLoading } = useProfile();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  
  // AI Recommendation State
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [outbreakDataTimestamp, setOutbreakDataTimestamp] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // AI Services
  const [riskAnalyzer] = useState(() => new RiskAnalyzer());
  const [cacheManager] = useState(() => new CacheManager());
  const [recommendationGenerator] = useState(() => {
    // NovaService is initialized with API endpoint from aws-exports
    const apiEndpoint = 'https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev';
    const apiKey = ''; // Not needed for IAM auth
    const novaService = new NovaService(apiEndpoint, apiKey);
    return new RecommendationGenerator(novaService);
  });

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace("/onboarding");
    }
  }, [profile, isLoading]);

  useEffect(() => {
    if (profile && !isLoading) {
      loadRecommendation();
    }
  }, [profile, isLoading]);

  const loadRecommendation = async () => {
    if (!profile) return;

    try {
      const childProfile = convertProfileToChildProfile(profile);
      const language = profile.country === 'JP' ? Language.JAPANESE : Language.ENGLISH;

      // Check cache first
      const cached = await cacheManager.getCachedRecommendation(childProfile);
      
      if (cached && !cached.isStale) {
        setRiskLevel(cached.recommendation.riskLevel);
        setRecommendation(cached.recommendation);
        setOutbreakDataTimestamp(cached.outbreakDataTimestamp);
        return;
      }

      // Generate new recommendation
      await generateNewRecommendation(childProfile, language);
    } catch (err) {
      console.error('Error loading recommendation:', err);
    }
  };

  const generateNewRecommendation = async (
    childProfile: ChildProfile,
    language: Language
  ) => {
    setIsGenerating(true);

    try {
      const mockOutbreakData = getOutbreakDataForArea(
        childProfile.location.stateOrPrefecture,
        childProfile.location.country as 'JP' | 'US'
      );
      const outbreakData = convertMockToOutbreakData(mockOutbreakData);
      const dataTimestamp = new Date();

      // Calculate risk level
      const calculatedRiskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      setRiskLevel(calculatedRiskLevel);

      // Generate recommendation
      const newRecommendation = await recommendationGenerator.generateRecommendation(
        calculatedRiskLevel,
        outbreakData,
        childProfile,
        language
      );

      setRecommendation(newRecommendation);
      setOutbreakDataTimestamp(dataTimestamp);

      // Cache the result
      await cacheManager.setCachedRecommendation(
        childProfile,
        newRecommendation,
        dataTimestamp
      );
    } catch (err) {
      console.error('Error generating recommendation:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const onRefresh = async () => {
    if (!profile) return;

    setRefreshing(true);
    try {
      const childProfile = convertProfileToChildProfile(profile);
      const language = profile.country === 'JP' ? Language.JAPANESE : Language.ENGLISH;

      await cacheManager.invalidateCache(childProfile);
      await generateNewRecommendation(childProfile, language);
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setRefreshing(false);
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
  const outbreakData = getOutbreakDataForArea(profile.area, profile.country as 'JP' | 'US');
  const highRiskAreas = getHighestRiskAreas(profile.country as 'JP' | 'US', 5);

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
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Section 1: AI Recommendations (moved to top) */}
        <View style={styles.recommendationSection}>
          {riskLevel && (
            <View style={styles.section}>
              <RiskIndicator level={riskLevel as RiskIndicatorLevel} />
            </View>
          )}

          {isGenerating && riskLevel && !recommendation && (
            <View style={styles.section}>
              <LoadingMessage
                riskLevel={riskLevel as RiskIndicatorLevel}
                message={
                  profile?.country === 'JP'
                    ? 'パーソナライズされたガイダンスを生成中...'
                    : 'Generating personalized guidance...'
                }
              />
            </View>
          )}

          {recommendation && (
            <View style={styles.section}>
              <RecommendationContent
                recommendation={recommendation}
              />
            </View>
          )}
        </View>

        {/* Section 2: Feedback UI */}
        {recommendation && profile && (
          <View style={styles.section}>
            <FeedbackUI
              recommendationId={recommendation.id}
              riskLevel={recommendation.riskLevel}
              ageRange={recommendation.childAgeRange}
              language={recommendation.language}
              source={recommendation.source}
            />
          </View>
        )}

        {/* Section 3: Local Outbreak Status */}
        <View style={styles.outbreakSection}>
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
        </View>

        {/* Section 4: High Risk Areas */}
        <View style={styles.highRiskSection}>
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
        </View>

        {/* Data Timestamp (moved to bottom) */}
        {outbreakDataTimestamp && (
          <View style={styles.section}>
            <DataTimestamp outbreakDataTimestamp={outbreakDataTimestamp} />
          </View>
        )}

        {/* Medical Disclaimer */}
        {profile && (
          <View style={styles.disclaimer}>
            <MedicalDisclaimer country={profile.country} />
          </View>
        )}
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
  // Section containers for visual separation
  recommendationSection: {
    backgroundColor: Colors.background,
    paddingBottom: 8,
  },
  outbreakSection: {
    backgroundColor: Colors.background,
    paddingBottom: 8,
  },
  highRiskSection: {
    backgroundColor: Colors.background,
    paddingBottom: 8,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginTop: 16,
  },
});
