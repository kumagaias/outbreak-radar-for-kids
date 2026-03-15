/**
 * Cost Tracker Component (Optional)
 * 
 * Tracks Nova API usage and estimates costs for monitoring and optimization.
 * 
 * Metrics tracked:
 * - Nova Lite calls
 * - Nova Micro calls
 * - Fallback usage
 * - Estimated cost per call
 * 
 * Data is saved to AsyncStorage for persistence.
 * 
 * Requirements: None (future enhancement)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NovaModel } from './nova-service';

/**
 * Cost metrics interface
 */
export interface CostMetrics {
  novaLiteCalls: number;
  novaMicroCalls: number;
  fallbackUsage: number;
  estimatedCost: number;
  lastUpdated: Date;
}

/**
 * Cost Tracker for monitoring Nova API usage
 */
export class CostTracker {
  private readonly STORAGE_KEY = 'cost_metrics';
  
  // Pricing per call (example values, update with actual pricing)
  private readonly LITE_COST_PER_CALL = 0.0015; // $0.0015 per call
  private readonly MICRO_COST_PER_CALL = 0.00015; // $0.00015 per call

  /**
   * Track a Nova API call
   * 
   * @param model - Nova model used (LITE or MICRO)
   */
  async trackCall(model: NovaModel): Promise<void> {
    const metrics = await this.getMetrics();

    if (model === NovaModel.LITE) {
      metrics.novaLiteCalls++;
      metrics.estimatedCost += this.LITE_COST_PER_CALL;
    } else if (model === NovaModel.MICRO) {
      metrics.novaMicroCalls++;
      metrics.estimatedCost += this.MICRO_COST_PER_CALL;
    }

    metrics.lastUpdated = new Date();
    await this.saveMetrics(metrics);
  }

  /**
   * Track fallback usage (when Nova service is unavailable)
   */
  async trackFallback(): Promise<void> {
    const metrics = await this.getMetrics();
    metrics.fallbackUsage++;
    metrics.lastUpdated = new Date();
    await this.saveMetrics(metrics);
  }

  /**
   * Get current cost metrics
   * 
   * @returns Current cost metrics
   */
  async getMetrics(): Promise<CostMetrics> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          lastUpdated: new Date(parsed.lastUpdated)
        };
      }
    } catch (error) {
      console.warn('Failed to load cost metrics:', error);
    }

    // Return default metrics if not found or error
    return {
      novaLiteCalls: 0,
      novaMicroCalls: 0,
      fallbackUsage: 0,
      estimatedCost: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Save cost metrics to AsyncStorage
   */
  private async saveMetrics(metrics: CostMetrics): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(metrics));
    } catch (error) {
      console.error('Failed to save cost metrics:', error);
    }
  }

  /**
   * Reset cost metrics (useful for testing or monthly resets)
   */
  async resetMetrics(): Promise<void> {
    const metrics: CostMetrics = {
      novaLiteCalls: 0,
      novaMicroCalls: 0,
      fallbackUsage: 0,
      estimatedCost: 0,
      lastUpdated: new Date()
    };
    await this.saveMetrics(metrics);
  }

  /**
   * Calculate estimated monthly cost based on current usage
   * 
   * @param daysElapsed - Number of days since tracking started
   * @returns Estimated monthly cost in USD
   */
  async estimateMonthlyCost(daysElapsed: number): Promise<number> {
    if (daysElapsed <= 0) {
      return 0;
    }

    const metrics = await this.getMetrics();
    const dailyAverage = metrics.estimatedCost / daysElapsed;
    return dailyAverage * 30; // Estimate for 30 days
  }
}
