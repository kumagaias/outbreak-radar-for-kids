/**
 * Cache Manager Component
 * 
 * Manages recommendation caching with 24-hour TTL and staleness detection.
 * 
 * Key responsibilities:
 * - Cache recommendations in AsyncStorage
 * - 24-hour TTL check (isStale flag)
 * - Cache key generation (ageRange + prefecture/state)
 * - Cache invalidation on data change
 * - Track outbreak data timestamp for staleness detection
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recommendation, ChildProfile, AgeRange } from './types';

/**
 * Cached recommendation with metadata
 */
export interface CachedRecommendation {
  recommendation: Recommendation;
  isStale: boolean;
  age: number; // milliseconds
  outbreakDataTimestamp: Date;
}

/**
 * Cache data structure stored in AsyncStorage
 */
interface CacheData {
  recommendation: Recommendation;
  timestamp: number;
  outbreakDataTimestamp: number;
  childAgeRange: AgeRange;
}

/**
 * Cache Manager
 */
export class CacheManager {
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_KEY_PREFIX = 'rec_';

  /**
   * Generate cache key based on age range and prefecture/state
   */
  private generateCacheKey(childProfile: ChildProfile): string {
    // Cache key based on age range and prefecture/state only
    // Format: rec_{ageRange}_{prefecture/state}
    return `${this.CACHE_KEY_PREFIX}${childProfile.ageRange}_${childProfile.location.stateOrPrefecture}`;
  }

  /**
   * Get cached recommendation
   */
  async getCachedRecommendation(
    childProfile: ChildProfile
  ): Promise<CachedRecommendation | null> {
    try {
      const cacheKey = this.generateCacheKey(childProfile);
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) {
        return null;
      }

      const data: CacheData = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      // Convert stored timestamps back to Date objects
      const recommendation: Recommendation = {
        ...data.recommendation,
        generatedAt: new Date(data.recommendation.generatedAt),
        outbreakDataTimestamp: new Date(data.recommendation.outbreakDataTimestamp)
      };

      return {
        recommendation,
        isStale: age > this.CACHE_TTL_MS,
        age,
        outbreakDataTimestamp: new Date(data.outbreakDataTimestamp)
      };
    } catch (error) {
      console.error('Failed to read cache:', error);
      return null;
    }
  }

  /**
   * Set cached recommendation
   */
  async setCachedRecommendation(
    childProfile: ChildProfile,
    recommendation: Recommendation,
    outbreakDataTimestamp: Date
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(childProfile);
      const data: CacheData = {
        recommendation,
        timestamp: Date.now(),
        outbreakDataTimestamp: outbreakDataTimestamp.getTime(),
        childAgeRange: childProfile.ageRange
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to write cache:', error);
      // Don't throw - cache write failure shouldn't break the app
    }
  }

  /**
   * Invalidate cache for a child profile
   */
  async invalidateCache(childProfile: ChildProfile): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(childProfile);
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  }

  /**
   * Check if age range has changed since last cache
   */
  async checkAgeRangeChange(childProfile: ChildProfile): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(childProfile);
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) {
        return false;
      }

      const data: CacheData = JSON.parse(cached);
      const cachedAgeRange = data.childAgeRange;

      // If age range changed, invalidate cache
      if (cachedAgeRange !== childProfile.ageRange) {
        await this.invalidateCache(childProfile);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check age range change:', error);
      return false;
    }
  }

  /**
   * Check if outbreak data has changed since last cache
   */
  async checkOutbreakDataChange(
    childProfile: ChildProfile,
    currentOutbreakDataTimestamp: Date
  ): Promise<boolean> {
    try {
      const cached = await this.getCachedRecommendation(childProfile);

      if (!cached) {
        return false;
      }

      // Compare timestamps
      const cachedTimestamp = cached.outbreakDataTimestamp.getTime();
      const currentTimestamp = currentOutbreakDataTimestamp.getTime();

      // If outbreak data changed, invalidate cache
      if (cachedTimestamp !== currentTimestamp) {
        await this.invalidateCache(childProfile);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check outbreak data change:', error);
      return false;
    }
  }

  /**
   * Prune old cached recommendations
   * 
   * Keeps only the latest 20 recommendations per child profile to prevent device storage bloat.
   * This is critical for users with limited device storage.
   * 
   * Strategy:
   * - List all cached recommendations
   * - Sort by timestamp (newest first)
   * - Keep latest 20 per child profile
   * - Delete older entries
   * 
   * Requirements: 9.2, 9.3, 9.4, 9.6, 9.7
   * Design: Section "ローカルストレージの死蔵キャッシュ対策"
   */
  async pruneOldCache(): Promise<void> {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter for recommendation cache keys only
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_KEY_PREFIX));
      
      if (cacheKeys.length <= 20) {
        // No pruning needed
        return;
      }
      
      // Get all cached data with timestamps
      const cacheEntries: Array<{ key: string; timestamp: number }> = [];
      
      for (const key of cacheKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const data: CacheData = JSON.parse(cached);
            cacheEntries.push({ key, timestamp: data.timestamp });
          }
        } catch (error) {
          console.warn(`Failed to read cache entry ${key}:`, error);
          // Continue with other entries
        }
      }
      
      // Sort by timestamp (newest first)
      cacheEntries.sort((a, b) => b.timestamp - a.timestamp);
      
      // Keep latest 20, delete the rest
      const keysToDelete = cacheEntries.slice(20).map(entry => entry.key);
      
      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
        console.log(`Pruned ${keysToDelete.length} old cache entries`);
      }
    } catch (error) {
      console.error('Failed to prune old cache:', error);
      // Don't throw - cache pruning failure shouldn't break the app
    }
  }
}
