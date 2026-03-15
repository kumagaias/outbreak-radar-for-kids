/**
 * RecommendationScreen Component
 * 
 * Integrates all AI recommendation components:
 * - RiskIndicator: Visual risk display
 * - RecommendationContent: Summary and action items
 * - LoadingMessage: Progressive loading state
 * - MedicalDisclaimer: Medical disclaimer
 * - FeedbackUI: User feedback collection
 * 
 * Services:
 * - RiskAnalyzer: Calculate risk level
 * - RecommendationGenerator: Generate recommendations
 * - CacheManager: Cache management
 * - FeedbackCollector: Feedback collection
 * 
 * **Validates: All requirements**
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useProfile } from '@/lib/profile-context';
import { getOutbreakDataForArea } from '@/lib/mock-data';

// Components
import { RiskIndicator, type RiskLevel as RiskIndicatorLevel } from '@/components/RiskIndicator';
import { RecommendationContent } from '@/components/RecommendationContent';
import { LoadingMessage } from '@/components/LoadingMessage';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { FeedbackUI } from '@/components/FeedbackUI';
import { ProgressiveRecommendationView } from '@/components/ProgressiveRecommendationView';

// Services
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

/**
 * Convert mock data to OutbreakData format
 */
function convertMockToOutbreakData(mockData: any[]): OutbreakData[] {
  return mockData.map(outbreak => ({
    diseaseId: outbreak.diseaseId,
    diseaseName: outbreak.diseaseName || outbreak.diseaseId,
    diseaseNameLocal: outbreak.diseaseNameLocal,
    severity: outbreak.level === 'high' ? 8 : outbreak.level === 'medium' ? 5 : 2,
    geographicUnit: {
      country: outbreak.country || 'JP',
      stateOrPrefecture: outbreak.area || 'Tokyo',
    },
    affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER, AgeRange.PRESCHOOL],
    reportedCases: outbreak.cases || 0,
    timestamp: new Date(),
  }));
}

/**
 * Convert profile to ChildProfile format
 */
function convertProfileToChildProfile(profile: any): ChildProfile {
  // Determine age range from first child or default to PRESCHOOL
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
      country: profile.country || 'JP',
      stateOrPrefecture: profile.area || 'Tokyo',
    },
  };
}

export default function RecommendationScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isLoading: profileLoading } = useProfile();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  // State
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [cachedRecommendation, setCachedRecommendation] = useState<Recommendation | null>(null);
  const [outbreakDataTimestamp, setOutbreakDataTimestamp] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Services
  const [riskAnalyzer] = useState(() => new RiskAnalyzer());
  const [cacheManager] = useState(() => new CacheManager());
  const [recommendationGenerator] = useState(() => {
    const novaService = new NovaService();
    return new RecommendationGenerator(novaService);
  });

  // Redirect to onboarding if no profile
  useEffect(() => {
    if (!profileLoading && !profile) {
      router.replace('/onboarding');
    }
  }, [profile, profileLoading]);

  // Load recommendation on mount
  useEffect(() => {
    if (profile && !profileLoading) {
      loadRecommendation();
      // Prune old cache entries on app startup to prevent storage bloat
      cacheManager.pruneOldCache().catch(err => {
        console.warn('Failed to prune old cache:', err);
      });
    }
  }, [profile, profileLoading]);

  /**
   * Load recommendation (check cache first, then generate if needed)
   */
  const loadRecommendation = async () => {
    if (!profile) return;

    setIsLoading(true);
    setError(null);

    try {
      const childProfile = convertProfileToChildProfile(profile);
      const language = profile.country === 'JP' ? Language.JAPANESE : Language.ENGLISH;

      // Step 1: Check cache
      const cached = await cacheManager.getCachedRecommendation(childProfile);
      
      if (cached && !cached.isStale) {
        // Cache hit - display within 3 seconds
        setRiskLevel(cached.recommendation.riskLevel);
        setRecommendation(cached.recommendation);
        setCachedRecommendation(cached.recommendation);
        setOutbreakDataTimestamp(cached.outbreakDataTimestamp);
        setIsLoading(false);
        return;
      }

      // If cache is stale but exists, show it while generating new
      if (cached && cached.isStale) {
        setRiskLevel(cached.recommendation.riskLevel);
        setCachedRecommendation(cached.recommendation);
        setOutbreakDataTimestamp(cached.outbreakDataTimestamp);
        setIsLoading(false);
      }

      // Step 2: Cache miss or stale - generate new recommendation
      await generateNewRecommendation(childProfile, language);
    } catch (err) {
      console.error('Error loading recommendation:', err);
      setError(
        profile.country === 'JP'
          ? '推奨事項の読み込みに失敗しました'
          : 'Failed to load recommendation'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Generate new recommendation
   */
  const generateNewRecommendation = async (
    childProfile: ChildProfile,
    language: Language
  ) => {
    setIsGenerating(true);

    try {
      // Get outbreak data
      const mockOutbreakData = getOutbreakDataForArea(
        childProfile.location.stateOrPrefecture,
        childProfile.location.country
      );
      const outbreakData = convertMockToOutbreakData(mockOutbreakData);
      const dataTimestamp = new Date();

      // Step 1: Calculate risk level (fast - show immediately)
      const calculatedRiskLevel = await riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );
      setRiskLevel(calculatedRiskLevel);

      // Step 2: Generate recommendation (may take up to 5 seconds)
      const newRecommendation = await recommendationGenerator.generateRecommendation(
        calculatedRiskLevel,
        outbreakData,
        childProfile,
        language
      );

      // Step 3: Display recommendation
      setRecommendation(newRecommendation);
      setCachedRecommendation(null); // Clear cached recommendation when new one is ready
      setOutbreakDataTimestamp(dataTimestamp);

      // Step 4: Cache the result
      await cacheManager.setCachedRecommendation(
        childProfile,
        newRecommendation,
        dataTimestamp
      );
    } catch (err) {
      console.error('Error generating recommendation:', err);
      
      // Offline mode fallback: If network error and cache is stale/missing,
      // use generateOfflineModeRecommendation to show minimal essential actions
      if (err instanceof Error && (err.message.includes('network') || err.message.includes('timeout'))) {
        console.log('Network error detected, using offline mode recommendation');
        
        // Get outbreak data for risk calculation
        const mockOutbreakData = getOutbreakDataForArea(
          childProfile.location.stateOrPrefecture,
          childProfile.location.country
        );
        const outbreakData = convertMockToOutbreakData(mockOutbreakData);
        
        // Calculate risk level locally
        const calculatedRiskLevel = await riskAnalyzer.calculateRiskLevel(
          outbreakData,
          childProfile
        );
        setRiskLevel(calculatedRiskLevel);
        
        // Generate offline mode recommendation
        const offlineRecommendation = recommendationGenerator.generateOfflineModeRecommendation(
          calculatedRiskLevel,
          childProfile,
          language
        );
        
        setRecommendation(offlineRecommendation);
        setCachedRecommendation(null);
        setOutbreakDataTimestamp(new Date());
      } else {
        throw err;
      }
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    if (!profile) return;

    setRefreshing(true);
    try {
      const childProfile = convertProfileToChildProfile(profile);
      const language = profile.country === 'JP' ? Language.JAPANESE : Language.ENGLISH;

      // Invalidate cache and generate new
      await cacheManager.invalidateCache(childProfile);
      await generateNewRecommendation(childProfile, language);
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Loading state
  if (profileLoading || isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.loadingContainer}>
          {riskLevel ? (
            <LoadingMessage
              riskLevel={riskLevel as RiskIndicatorLevel}
              message={
                profile?.country === 'JP'
                  ? 'パーソナライズされたガイダンスを生成中...'
                  : 'Generating personalized guidance...'
              }
            />
          ) : (
            <Text style={styles.loadingText}>
              {profile?.country === 'JP' ? '読み込み中...' : 'Loading...'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Main content
  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Progressive Recommendation View */}
        {riskLevel && (
          <ProgressiveRecommendationView
            riskLevel={riskLevel as RiskIndicatorLevel}
            cachedRecommendation={cachedRecommendation || undefined}
            isGenerating={isGenerating}
            generatedRecommendation={recommendation || undefined}
            outbreakDataTimestamp={outbreakDataTimestamp || undefined}
          />
        )}

        {/* Medical Disclaimer */}
        {profile && recommendation && (
          <View style={styles.section}>
            <MedicalDisclaimer country={profile.country} />
          </View>
        )}

        {/* Feedback UI */}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
  },
});
