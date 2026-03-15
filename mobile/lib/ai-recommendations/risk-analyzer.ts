/**
 * Risk_Analyzer component
 * Evaluates outbreak data and child profile to determine risk level
 */

import {
  RiskLevel,
  AgeRange,
  OutbreakData,
  ChildProfile,
  RiskAnalysisResult,
  GeographicUnit
} from './types';

/**
 * Age-based susceptibility weights for different diseases
 */
const AGE_SUSCEPTIBILITY_WEIGHTS: Record<AgeRange, Record<string, number>> = {
  [AgeRange.INFANT]: {
    respiratory: 1.5,
    gastrointestinal: 1.2,
    default: 1.3
  },
  [AgeRange.TODDLER]: {
    'hand-foot-mouth': 1.3,
    flu: 1.1,
    default: 1.2
  },
  [AgeRange.PRESCHOOL]: {
    default: 1.0
  },
  [AgeRange.SCHOOL_AGE]: {
    default: 0.9
  }
};

/**
 * Severity thresholds for risk classification
 */
const SEVERITY_THRESHOLDS = {
  HIGH: 7,
  MEDIUM: 4,
  LOW: 3
};

/**
 * Geographic proximity factors
 */
const GEOGRAPHIC_PROXIMITY_FACTORS = {
  EXACT_MATCH: 1.0,
  PREFECTURE_STATE_FALLBACK: 0.8,
  NATIONAL_FALLBACK: 0.5
};

export class RiskAnalyzer {
  /**
   * Calculate risk level based on outbreak data and child profile
   */
  async calculateRiskLevel(
    outbreakData: OutbreakData[],
    childProfile: ChildProfile
  ): Promise<RiskLevel> {
    // Step 1: Filter outbreaks by geographic proximity
    const relevantOutbreaks = this.filterByGeography(
      outbreakData,
      childProfile.location
    );

    // Step 2: Apply age-based susceptibility weights
    const weightedOutbreaks = this.applyAgeWeights(
      relevantOutbreaks,
      childProfile.ageRange
    );

    // Step 3: Determine risk level based on severity
    return this.determineRiskLevel(weightedOutbreaks);
  }

  /**
   * Filter outbreaks by geographic proximity with fallback logic
   */
  private filterByGeography(
    outbreakData: OutbreakData[],
    userLocation: GeographicUnit
  ): Array<OutbreakData & { proximityFactor: number }> {
    return outbreakData
      .map(outbreak => {
        const proximityFactor = this.calculateProximityFactor(
          outbreak.geographicUnit,
          userLocation
        );
        
        return proximityFactor > 0
          ? { ...outbreak, proximityFactor }
          : null;
      })
      .filter((outbreak): outbreak is OutbreakData & { proximityFactor: number } => 
        outbreak !== null
      );
  }

  /**
   * Calculate geographic proximity factor
   */
  private calculateProximityFactor(
    outbreakLocation: GeographicUnit,
    userLocation: GeographicUnit
  ): number {
    // Different country - no relevance
    if (outbreakLocation.country !== userLocation.country) {
      return 0;
    }

    // Exact match (ward/county level)
    if (
      outbreakLocation.countyOrWard &&
      userLocation.countyOrWard &&
      outbreakLocation.countyOrWard === userLocation.countyOrWard &&
      outbreakLocation.stateOrPrefecture === userLocation.stateOrPrefecture
    ) {
      return GEOGRAPHIC_PROXIMITY_FACTORS.EXACT_MATCH;
    }

    // Prefecture/state level match
    // If outbreak data has no ward/county but prefecture matches, treat as exact match
    // (outbreak data is at prefecture level, which is the best available granularity)
    if (outbreakLocation.stateOrPrefecture === userLocation.stateOrPrefecture) {
      return GEOGRAPHIC_PROXIMITY_FACTORS.EXACT_MATCH;
    }

    // National fallback (same country, different prefecture/state)
    return GEOGRAPHIC_PROXIMITY_FACTORS.NATIONAL_FALLBACK;
  }

  /**
   * Apply age-based susceptibility weights
   */
  private applyAgeWeights(
    outbreaks: Array<OutbreakData & { proximityFactor: number }>,
    ageRange: AgeRange
  ): Array<OutbreakData & { proximityFactor: number; weightedSeverity: number }> {
    const ageWeights = AGE_SUSCEPTIBILITY_WEIGHTS[ageRange] || { default: 1.0 };

    return outbreaks.map(outbreak => {
      // Determine disease category weight
      let categoryWeight = ageWeights.default || 1.0;
      
      // Check for specific disease patterns
      const diseaseLower = outbreak.diseaseName.toLowerCase();
      if (diseaseLower.includes('rsv') || diseaseLower.includes('respiratory')) {
        categoryWeight = ageWeights.respiratory || ageWeights.default || 1.0;
      } else if (diseaseLower.includes('hand-foot-mouth') || diseaseLower.includes('hfmd')) {
        categoryWeight = ageWeights['hand-foot-mouth'] || ageWeights.default || 1.0;
      } else if (diseaseLower.includes('flu') || diseaseLower.includes('influenza')) {
        categoryWeight = ageWeights.flu || ageWeights.default || 1.0;
      } else if (diseaseLower.includes('gastro') || diseaseLower.includes('norovirus')) {
        categoryWeight = ageWeights.gastrointestinal || ageWeights.default || 1.0;
      }

      // Calculate weighted severity
      const weightedSeverity = 
        outbreak.severity * 
        outbreak.proximityFactor * 
        categoryWeight;

      return {
        ...outbreak,
        weightedSeverity
      };
    });
  }

  /**
   * Determine risk level based on weighted severity
   */
  private determineRiskLevel(
    weightedOutbreaks: Array<OutbreakData & { weightedSeverity: number }>
  ): RiskLevel {
    // No outbreaks - low risk
    if (weightedOutbreaks.length === 0) {
      return RiskLevel.LOW;
    }

    // Check for high severity outbreaks
    const hasHighSeverity = weightedOutbreaks.some(
      outbreak => outbreak.weightedSeverity >= SEVERITY_THRESHOLDS.HIGH
    );
    if (hasHighSeverity) {
      return RiskLevel.HIGH;
    }

    // Check for medium severity outbreaks
    const hasMediumSeverity = weightedOutbreaks.some(
      outbreak => 
        outbreak.weightedSeverity >= SEVERITY_THRESHOLDS.MEDIUM &&
        outbreak.weightedSeverity < SEVERITY_THRESHOLDS.HIGH
    );
    if (hasMediumSeverity) {
      return RiskLevel.MEDIUM;
    }

    // Only low severity outbreaks
    return RiskLevel.LOW;
  }

  /**
   * Get detailed risk analysis result
   */
  async analyzeRisk(
    outbreakData: OutbreakData[],
    childProfile: ChildProfile
  ): Promise<RiskAnalysisResult> {
    const riskLevel = await this.calculateRiskLevel(outbreakData, childProfile);
    
    const relevantOutbreaks = this.filterByGeography(
      outbreakData,
      childProfile.location
    );

    const primaryDiseases = relevantOutbreaks
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 3)
      .map(o => o.diseaseName);

    const riskFactors: string[] = [];
    if (relevantOutbreaks.length > 0) {
      riskFactors.push(`${relevantOutbreaks.length} outbreak(s) in area`);
    }
    if (childProfile.ageRange === AgeRange.INFANT) {
      riskFactors.push('Infant age group (higher susceptibility)');
    }

    return {
      riskLevel,
      relevantOutbreaks,
      primaryDiseases,
      riskFactors
    };
  }
}
