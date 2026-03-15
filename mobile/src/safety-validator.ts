/**
 * Safety Validator Module
 * 
 * Validates AI-generated recommendations for safety concerns:
 * - Medical diagnosis phrases (禁止)
 * - Alarmist language (危険, emergency, crisis)
 * - Temperature thresholds (37.5°C for Japanese, 99.5°F for English)
 * - Age-appropriate guidance (no "gargle" for infants)
 * 
 * Implements "Suspicious is fallback" principle:
 * Any uncertainty triggers fallback to ensure user safety.
 * 
 * Validates: Requirements 13.8, 13.9, 3.4, 3.5
 */

import { AgeRange } from '../lib/ai-recommendations/types';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface TemperatureConstraints {
  min: number;
  max: number;
  threshold: number;
}

export class SafetyValidator {
  // Medical diagnosis patterns (STRICT enforcement)
  private readonly DIAGNOSIS_PATTERNS = [
    /疑いがあります/,
    /suspected of/i,
    /diagnosed with/i,
    /has [a-z\s]+ disease/i,
    /お子様は.*です/,
    /your child has/i,
    /感染しています/,
    /infected with/i,
    /治療.*推奨/,
    /treatment.*recommend/i
  ];

  // Alarmist language patterns (STRICT enforcement)
  private readonly ALARMIST_PATTERNS = [
    /危険/gi,
    /緊急/gi,
    /重大/gi,
    /深刻/gi,
    /dangerous/gi,
    /urgent/gi,
    /emergency/gi,
    /severe danger/gi,
    /crisis/gi
  ];

  // Temperature constraints
  private readonly TEMPERATURE_CONSTRAINTS = {
    celsius: { min: 36.0, max: 42.0, threshold: 37.5 },
    fahrenheit: { min: 96.8, max: 107.6, threshold: 99.5 }
  };

  /**
   * Main validation entry point
   * Returns false if ANY validation fails (suspicious is fallback)
   */
  validateSafety(
    recommendation: { summary: string; actionItems: string[] },
    ageRange?: AgeRange
  ): ValidationResult {
    const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');

    // Check for medical diagnosis phrases
    const diagnosisCheck = this.checkMedicalDiagnosis(fullText);
    if (!diagnosisCheck.isValid) {
      return diagnosisCheck;
    }

    // Check for alarmist language
    const alarmistCheck = this.checkAlarmistLanguage(fullText);
    if (!alarmistCheck.isValid) {
      return alarmistCheck;
    }

    // Check temperature thresholds
    const temperatureCheck = this.validateTemperatureThresholds(fullText);
    if (!temperatureCheck.isValid) {
      return temperatureCheck;
    }

    // Check age-appropriate guidance (if age range provided)
    if (ageRange) {
      const ageCheck = this.validateAgeAppropriateness(fullText, ageRange);
      if (!ageCheck.isValid) {
        return ageCheck;
      }
    }

    return { isValid: true };
  }

  /**
   * Check for medical diagnosis phrases
   */
  private checkMedicalDiagnosis(text: string): ValidationResult {
    for (const pattern of this.DIAGNOSIS_PATTERNS) {
      if (pattern.test(text)) {
        console.error('Safety validation failed: Medical diagnosis phrase detected', {
          pattern: pattern.source,
          textPreview: text.substring(0, 100)
        });
        return {
          isValid: false,
          reason: 'Medical diagnosis phrase detected'
        };
      }
    }
    return { isValid: true };
  }

  /**
   * Check for alarmist language
   */
  private checkAlarmistLanguage(text: string): ValidationResult {
    for (const pattern of this.ALARMIST_PATTERNS) {
      if (pattern.test(text)) {
        console.error('Safety validation failed: Alarmist language detected', {
          pattern: pattern.source
        });
        return {
          isValid: false,
          reason: 'Alarmist language detected'
        };
      }
    }
    return { isValid: true };
  }

  /**
   * Validate temperature thresholds
   * Checks for:
   * - Valid temperature ranges (36-42°C, 96.8-107.6°F)
   * - Correct thresholds (37.5°C for Japanese, 99.5°F for English)
   */
  validateTemperatureThresholds(text: string): ValidationResult {
    // Extract temperature values with units
    const celsiusPattern = /(\d+\.?\d*)\s*°?C/gi;
    const fahrenheitPattern = /(\d+\.?\d*)\s*°?F/gi;

    // Check Celsius values
    const celsiusMatches = Array.from(text.matchAll(celsiusPattern));
    for (const match of celsiusMatches) {
      const temp = parseFloat(match[1]);
      
      // Validate range
      if (temp < this.TEMPERATURE_CONSTRAINTS.celsius.min || 
          temp > this.TEMPERATURE_CONSTRAINTS.celsius.max) {
        console.error(`Invalid Celsius temperature: ${temp}°C`);
        return {
          isValid: false,
          reason: `Invalid Celsius temperature: ${temp}°C (valid range: ${this.TEMPERATURE_CONSTRAINTS.celsius.min}-${this.TEMPERATURE_CONSTRAINTS.celsius.max}°C)`
        };
      }

      // Warn if threshold is not 37.5°C for Japanese context
      if (text.includes('登園') || text.includes('保育園')) {
        if (Math.abs(temp - this.TEMPERATURE_CONSTRAINTS.celsius.threshold) > 0.5) {
          console.warn(`Non-standard Japanese fever threshold: ${temp}°C (expected 37.5°C)`);
        }
      }
    }

    // Check Fahrenheit values
    const fahrenheitMatches = Array.from(text.matchAll(fahrenheitPattern));
    for (const match of fahrenheitMatches) {
      const temp = parseFloat(match[1]);
      
      // Validate range
      if (temp < this.TEMPERATURE_CONSTRAINTS.fahrenheit.min || 
          temp > this.TEMPERATURE_CONSTRAINTS.fahrenheit.max) {
        console.error(`Invalid Fahrenheit temperature: ${temp}°F`);
        return {
          isValid: false,
          reason: `Invalid Fahrenheit temperature: ${temp}°F (valid range: ${this.TEMPERATURE_CONSTRAINTS.fahrenheit.min}-${this.TEMPERATURE_CONSTRAINTS.fahrenheit.max}°F)`
        };
      }

      // Warn if threshold is not 99.5°F for English context
      if (text.includes('daycare') || text.includes('attendance')) {
        if (Math.abs(temp - this.TEMPERATURE_CONSTRAINTS.fahrenheit.threshold) > 0.5) {
          console.warn(`Non-standard English fever threshold: ${temp}°F (expected 99.5°F)`);
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Validate age-appropriate guidance
   * 
   * Infant (0-1 years) should not have instructions requiring child action.
   * Note: This validation checks for instructions directed AT the child, not caregivers.
   * 
   * Examples:
   * - ❌ "うがいをしましょう" (child should gargle) - NOT acceptable for infants
   * - ✅ "保護者が手洗いを徹底" (caregivers wash hands) - acceptable
   */
  validateAgeAppropriateness(text: string, ageRange: AgeRange): ValidationResult {
    // Infant (0-1 years) should not have instructions requiring child action
    if (ageRange === AgeRange.INFANT) {
      const infantInappropriatePatterns = [
        /うがいをし/gi,        // "do gargling" (action instruction)
        /手洗いをし/gi,        // "do handwashing" (action instruction)
        /gargle/gi,
        /wash.*your.*hands/gi, // "wash your hands" (directed at child)
        /rinse.*mouth/gi
      ];

      for (const pattern of infantInappropriatePatterns) {
        if (pattern.test(text)) {
          console.error('Safety validation failed: Age-inappropriate guidance for infant', {
            pattern: pattern.source,
            ageRange
          });
          return {
            isValid: false,
            reason: `Age-inappropriate guidance for infant (0-1 years): instruction requires child action`
          };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Get temperature constraints for reference
   */
  getTemperatureConstraints(): {
    celsius: TemperatureConstraints;
    fahrenheit: TemperatureConstraints;
  } {
    return this.TEMPERATURE_CONSTRAINTS;
  }
}

/**
 * Singleton instance for convenience
 */
export const safetyValidator = new SafetyValidator();
