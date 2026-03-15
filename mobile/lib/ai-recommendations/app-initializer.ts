/**
 * App Initializer Component
 * 
 * Manages app startup flow with background pre-generation of recommendations.
 * 
 * Key responsibilities:
 * - Start background tasks on app startup
 * - Prefetch latest outbreak data
 * - Pre-generate and cache recommendations
 * - Don't block UI rendering
 * - Log errors but don't fail app startup
 */

import { ChildProfile, OutbreakData, Language } from './types';
import { RiskAnalyzer } from './risk-analyzer';
import { RecommendationGenerator } from './recommendation-generator';
import { CacheManager } from './cache-manager';
import { NovaService } from './nova-service';

/**
 * Outbreak data fetcher function type
 * This should be provided by the app to fetch real outbreak data
 */
export type OutbreakDataFetcher = (
  location: string,
  country: string
) => Promise<OutbreakData[]>;

/**
 * App Initializer Configuration
 */
export interface AppInitializerConfig {
  /**
   * Function to fetch outbreak data
   */
  outbreakDataFetcher: OutbreakDataFetcher;

  /**
   * Child profiles to pre-generate recommendations for
   */
  childProfiles: ChildProfile[];

  /**
   * Language for recommendations
   */
  language: Language;

  /**
   * Whether to enable background pre-generation
   * Default: true
   */
  enablePreGeneration?: boolean;
}

/**
 * App Initializer
 */
export class AppInitializer {
  private riskAnalyzer: RiskAnalyzer;
  private recommendationGenerator: RecommendationGenerator;
  private cacheManager: CacheManager;
  private config: AppInitializerConfig;

  constructor(config: AppInitializerConfig) {
    this.config = config;
    this.riskAnalyzer = new RiskAnalyzer();
    this.cacheManager = new CacheManager();
    
    // Initialize Nova service and recommendation generator
    const novaService = new NovaService();
    this.recommendationGenerator = new RecommendationGenerator(novaService);
  }

  /**
   * Initialize app with background pre-generation
   * This should be called on app startup
   */
  async initialize(): Promise<void> {
    // Prune old cache entries on app startup to prevent storage bloat
    // This runs in background and doesn't block app startup
    this.cacheManager.pruneOldCache().catch(error => {
      console.warn('Failed to prune old cache:', error);
    });

    // Check if pre-generation is enabled
    if (this.config.enablePreGeneration === false) {
      console.log('Background pre-generation disabled');
      return;
    }

    // Start background tasks without blocking
    this.startBackgroundTasks().catch(error => {
      // Log error but don't fail app startup
      console.error('Background pre-generation failed:', error);
    });
  }

  /**
   * Start background tasks (non-blocking)
   */
  private async startBackgroundTasks(): Promise<void> {
    console.log('Starting background pre-generation...');

    // Process each child profile
    for (const childProfile of this.config.childProfiles) {
      try {
        // Prefetch outbreak data
        const outbreakData = await this.prefetchOutbreakData(childProfile);

        // Pre-generate recommendations
        await this.pregenerateRecommendations(
          childProfile,
          outbreakData
        );

        console.log(
          `Pre-generated recommendation for ${childProfile.ageRange} in ${childProfile.location.stateOrPrefecture}`
        );
      } catch (error) {
        // Log error but continue with other profiles
        console.error(
          `Failed to pre-generate for ${childProfile.ageRange}:`,
          error
        );
      }
    }

    console.log('Background pre-generation completed');
  }

  /**
   * Prefetch latest outbreak data
   */
  async prefetchOutbreakData(childProfile: ChildProfile): Promise<OutbreakData[]> {
    try {
      const outbreakData = await this.config.outbreakDataFetcher(
        childProfile.location.stateOrPrefecture,
        childProfile.location.country
      );

      console.log(
        `Fetched ${outbreakData.length} outbreak records for ${childProfile.location.stateOrPrefecture}`
      );

      return outbreakData;
    } catch (error) {
      console.error('Failed to fetch outbreak data:', error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Pre-generate and cache recommendations
   */
  async pregenerateRecommendations(
    childProfile: ChildProfile,
    outbreakData: OutbreakData[]
  ): Promise<void> {
    try {
      // Check if cache already exists and is fresh
      const cached = await this.cacheManager.getCachedRecommendation(childProfile);
      if (cached && !cached.isStale) {
        console.log('Fresh cache exists, skipping pre-generation');
        return;
      }

      // Calculate risk level
      const riskLevel = await this.riskAnalyzer.calculateRiskLevel(
        outbreakData,
        childProfile
      );

      // Generate recommendation
      const recommendation = await this.recommendationGenerator.generateRecommendation(
        riskLevel,
        outbreakData,
        childProfile,
        this.config.language
      );

      // Get outbreak data timestamp
      const outbreakDataTimestamp =
        outbreakData.length > 0
          ? new Date(Math.max(...outbreakData.map(o => o.timestamp.getTime())))
          : new Date();

      // Cache recommendation
      await this.cacheManager.setCachedRecommendation(
        childProfile,
        recommendation,
        outbreakDataTimestamp
      );

      console.log('Recommendation cached successfully');
    } catch (error) {
      console.error('Failed to pre-generate recommendation:', error);
      // Don't throw - cache failure shouldn't break the app
    }
  }
}
