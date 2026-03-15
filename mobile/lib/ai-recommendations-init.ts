/**
 * AI Recommendations Initialization
 * 
 * This module provides a simplified initialization interface for the AI recommendations system.
 * It integrates with the app's profile context and outbreak data services.
 */

import { AppInitializer, OutbreakDataFetcher } from './ai-recommendations/app-initializer';
import { ChildProfile, AgeRange, Language, OutbreakData as AIOutbreakData } from './ai-recommendations/types';
import { getOutbreakDataForArea, DISEASES, type Country, type OutbreakData } from './mock-data';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@outbreak_radar_profile';

/**
 * Convert severity level to numeric scale (1-10)
 */
function convertSeverity(level: 'low' | 'medium' | 'high'): number {
  switch (level) {
    case 'low':
      return 3;
    case 'medium':
      return 6;
    case 'high':
      return 9;
    default:
      return 5;
  }
}

/**
 * Get disease name by ID
 */
function getDiseaseName(diseaseId: string): string {
  const disease = DISEASES.find(d => d.id === diseaseId);
  return disease ? disease.name : diseaseId;
}

/**
 * Convert mock outbreak data to AI outbreak data format
 */
function convertOutbreakData(mockData: OutbreakData[], country: Country): AIOutbreakData[] {
  return mockData.map(data => ({
    diseaseId: data.diseaseId,
    diseaseName: getDiseaseName(data.diseaseId),
    severity: convertSeverity(data.level),
    geographicUnit: {
      country: country === 'JP' ? 'Japan' : 'United States',
      stateOrPrefecture: data.area,
    },
    affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER, AgeRange.PRESCHOOL, AgeRange.SCHOOL_AGE],
    reportedCases: data.cases,
    timestamp: new Date(data.lastUpdated),
  }));
}

/**
 * Convert age group string to AgeRange enum
 */
function convertAgeGroup(ageGroup: string): AgeRange {
  switch (ageGroup) {
    case '0-1':
      return AgeRange.INFANT;
    case '2-3':
      return AgeRange.TODDLER;
    case '4-6':
      return AgeRange.PRESCHOOL;
    case '7+':
      return AgeRange.SCHOOL_AGE;
    default:
      return AgeRange.TODDLER; // Default fallback
  }
}

/**
 * Outbreak data fetcher implementation
 */
const outbreakDataFetcher: OutbreakDataFetcher = async (location: string, country: string) => {
  const countryCode: Country = country === 'Japan' ? 'JP' : 'US';
  const mockData = getOutbreakDataForArea(location, countryCode);
  return convertOutbreakData(mockData, countryCode);
};

/**
 * Get child profiles from stored profile
 */
async function getChildProfiles(): Promise<ChildProfile[]> {
  try {
    const stored = await AsyncStorage.getItem(PROFILE_KEY);
    if (!stored) {
      return [];
    }

    const profile = JSON.parse(stored);
    if (!profile.children || profile.children.length === 0) {
      return [];
    }

    // Convert profile children to ChildProfile format
    return profile.children.map((child: any) => ({
      ageRange: convertAgeGroup(child.ageGroup),
      location: {
        country: profile.country === 'JP' ? 'Japan' : 'United States',
        stateOrPrefecture: profile.area,
      },
    }));
  } catch (error) {
    console.error('Failed to load child profiles:', error);
    return [];
  }
}

/**
 * Initialize AI recommendations system
 * This should be called on app startup
 */
export async function initializeAIRecommendations(): Promise<void> {
  try {
    // Get child profiles from storage
    const childProfiles = await getChildProfiles();

    // Skip initialization if no profiles exist yet
    if (childProfiles.length === 0) {
      console.log('No child profiles found, skipping AI recommendations initialization');
      return;
    }

    // Create app initializer
    const initializer = new AppInitializer({
      outbreakDataFetcher,
      childProfiles,
      language: Language.JAPANESE, // TODO: Get from user settings
      enablePreGeneration: true,
    });

    // Initialize (non-blocking)
    await initializer.initialize();
  } catch (error) {
    console.error('Failed to initialize AI recommendations:', error);
    // Don't throw - initialization failure shouldn't break the app
  }
}

/**
 * Generate recommendations for a specific area and outbreak data
 * This is a convenience function for use in UI components
 */
export async function generateRecommendations(params: {
  area: string;
  country: Country;
  outbreaks: OutbreakData[];
  childrenAges: string[];
  language?: 'ja' | 'en';
}): Promise<any> {
  const { area, country, outbreaks, childrenAges, language = 'ja' } = params;

  // Convert to AI format
  const aiOutbreaks = convertOutbreakData(outbreaks, country);
  const aiLanguage = language === 'ja' ? Language.JAPANESE : Language.ENGLISH;

  // Create child profile from first child (simplified)
  const childProfile: ChildProfile = {
    ageRange: childrenAges.length > 0 ? convertAgeGroup(childrenAges[0]) : AgeRange.TODDLER,
    location: {
      country: country === 'JP' ? 'Japan' : 'United States',
      stateOrPrefecture: area,
    },
  };

  // Import and use recommendation generator
  const { RecommendationGenerator } = await import('./ai-recommendations/recommendation-generator');
  const { NovaService } = await import('./ai-recommendations/nova-service');
  const { RiskAnalyzer } = await import('./ai-recommendations/risk-analyzer');

  // Create services
  const novaService = new NovaService();
  const riskAnalyzer = new RiskAnalyzer();
  const generator = new RecommendationGenerator(novaService);

  // Analyze risk
  const riskAnalysis = riskAnalyzer.analyzeRisk(aiOutbreaks, childProfile);

  // Generate recommendation
  const recommendation = await generator.generateRecommendation(
    riskAnalysis.overallRisk,
    aiOutbreaks,
    childProfile,
    aiLanguage
  );

  return recommendation;
}
