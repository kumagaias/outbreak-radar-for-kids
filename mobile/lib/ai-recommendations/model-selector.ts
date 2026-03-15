/**
 * Model Selector Component
 * 
 * Optimizes cost by selecting appropriate Nova model based on risk level and outbreak complexity.
 * 
 * Selection strategy:
 * - Nova Micro: LOW risk + simple outbreaks (single disease or low severity variance)
 * - Nova Lite: MEDIUM/HIGH risk or complex outbreaks (multiple high-severity diseases)
 * 
 * Requirements: 2.7, 9.1
 */

import { RiskLevel, OutbreakData } from './types';
import { NovaModel } from './nova-service';

/**
 * Model Selector for cost optimization
 */
export class ModelSelector {
  /**
   * Select appropriate Nova model based on risk level and outbreak complexity
   * 
   * @param riskLevel - Current risk level (HIGH, MEDIUM, LOW)
   * @param outbreakData - Array of outbreak data
   * @returns NovaModel.MICRO for simple scenarios, NovaModel.LITE for complex scenarios
   */
  selectModel(riskLevel: RiskLevel, outbreakData: OutbreakData[]): NovaModel {
    const complexity = this.calculateOutbreakComplexity(outbreakData);

    // Use Micro for LOW risk with simple outbreaks
    if (riskLevel === RiskLevel.LOW && complexity < 3) {
      return NovaModel.MICRO;
    }

    // Use Lite for all other scenarios (MEDIUM/HIGH risk or complex outbreaks)
    return NovaModel.LITE;
  }

  /**
   * Calculate outbreak complexity based on disease count and severity variance
   * 
   * Complexity factors:
   * - Number of unique diseases
   * - Severity variance (high variance = more complex)
   * 
   * @param outbreakData - Array of outbreak data
   * @returns Complexity score (higher = more complex)
   */
  calculateOutbreakComplexity(outbreakData: OutbreakData[]): number {
    if (outbreakData.length === 0) {
      return 0;
    }

    // Count unique diseases
    const diseaseCount = new Set(outbreakData.map(o => o.diseaseId)).size;

    // Calculate severity variance
    const severities = outbreakData.map(o => o.severity);
    const severityVariance = this.calculateVariance(severities);

    // Complexity = disease count + variance bonus
    // High variance (>2) adds 1 to complexity
    return diseaseCount + (severityVariance > 2 ? 1 : 0);
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return variance;
  }
}
