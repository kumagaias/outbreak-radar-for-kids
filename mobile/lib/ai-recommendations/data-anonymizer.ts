/**
 * DataAnonymizer - Privacy validation and data anonymization
 * 
 * Ensures no PII is transmitted to external services by:
 * - Converting exact age to age range
 * - Converting ward/county to prefecture/state only
 * - Validating no PII in payloads
 * - Filtering outbreak data for relevance
 */

import {
  ChildProfile,
  OutbreakData,
  GeographicUnit,
  AgeRange
} from './types';
import { PIIDetectedError, LocationTooGranularError } from './errors';

export interface AnonymizedProfile {
  ageRange: AgeRange;
  geographicArea: string;
  filteredOutbreakData: OutbreakData[];
}

export class DataAnonymizer {
  /**
   * Anonymize child profile and outbreak data for Nova Service
   * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7
   */
  anonymizeForNovaService(
    childProfile: ChildProfile,
    outbreakData: OutbreakData[]
  ): AnonymizedProfile {
    return {
      ageRange: childProfile.ageRange,
      geographicArea: this.anonymizeLocation(childProfile.location),
      filteredOutbreakData: this.filterOutbreakData(
        outbreakData,
        childProfile.location
      )
    };
  }

  /**
   * Anonymize location to prefecture/state level only
   * Requirements: 5.2, 5.6
   */
  private anonymizeLocation(location: GeographicUnit): string {
    // Only transmit prefecture/state level
    return `${location.stateOrPrefecture}, ${location.country}`;
  }

  /**
   * Filter outbreak data for relevance and cost optimization
   * Requirements: 5.4
   */
  private filterOutbreakData(
    outbreakData: OutbreakData[],
    location: GeographicUnit
  ): OutbreakData[] {
    // Exclude data irrelevant to target region or low-priority data
    // Optimize token cost and context window
    return outbreakData
      .filter(outbreak =>
        outbreak.geographicUnit.stateOrPrefecture === location.stateOrPrefecture
      )
      .filter(outbreak => outbreak.severity >= 4) // Exclude low severity (<4)
      .sort((a, b) => b.severity - a.severity) // Sort by severity
      .slice(0, 5); // Limit to max 5 outbreaks
  }

  /**
   * Validate that payload contains no PII
   * Uses structural sanitization (whitelist approach) to avoid false positives
   * Requirements: 5.2, 5.3, 5.5, 5.6, 5.7
   */
  validateNoPII(payload: any): boolean {
    // Structural sanitization: Validate only whitelisted properties
    // Avoids false positives from regex (e.g., "Severe Cough", "req-123-4567")

    const allowedProperties: Record<string, string[] | RegExp> = {
      ageRange: ['0-1', '2-3', '4-6', '7+'],
      geographicArea: /^[A-Za-z\s]+,\s[A-Z]{2}$/, // "Tokyo, JP" or "California, US"
      riskLevel: ['high', 'medium', 'low'],
      language: ['ja', 'en']
    };

    // Validate only allowed properties
    for (const [key, allowedValues] of Object.entries(allowedProperties)) {
      if (payload[key] === undefined) continue;

      if (Array.isArray(allowedValues)) {
        if (!allowedValues.includes(payload[key])) {
          console.error(`Invalid value for ${key}: ${payload[key]}`);
          throw new PIIDetectedError(`Invalid value for ${key}: ${payload[key]}`);
        }
      } else if (allowedValues instanceof RegExp) {
        if (!allowedValues.test(payload[key])) {
          console.error(`Invalid format for ${key}: ${payload[key]}`);
          throw new PIIDetectedError(`Invalid format for ${key}: ${payload[key]}`);
        }
      }
    }

    // Check for unexpected properties that might contain PII
    const allowedKeys = new Set([
      'ageRange',
      'geographicArea',
      'riskLevel',
      'language',
      'diseaseNames',
      'outbreakData'
    ]);

    for (const key of Object.keys(payload)) {
      if (!allowedKeys.has(key)) {
        console.warn(`Unexpected property in payload: ${key}`);
        throw new PIIDetectedError(`Unexpected property in payload: ${key}`);
      }
    }

    // Check for PII patterns in string values
    const piiPatterns = [
      { pattern: /\b\d{3}-\d{4}\b/, name: 'postal code' }, // Japanese postal code
      { pattern: /\b\d{5}(-\d{4})?\b/, name: 'US ZIP code' },
      { pattern: /\b\d{4}\s\d{4}\s\d{4}\s\d{4}\b/, name: 'credit card' },
      { pattern: /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/, name: 'full name' }, // Simple name pattern
      { pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, name: 'date of birth' },
      { pattern: /\b\d+\s+years?\s+old\b/i, name: 'exact age' },
      { pattern: /\b\d+\.\d+\s+years?\b/i, name: 'exact age with decimal' }
    ];

    const stringValues = this.extractStringValues(payload);
    for (const value of stringValues) {
      for (const { pattern, name } of piiPatterns) {
        if (pattern.test(value)) {
          console.error(`PII detected (${name}): ${value}`);
          throw new PIIDetectedError(`PII detected (${name}) in payload`);
        }
      }
    }

    return true;
  }

  /**
   * Extract all string values from payload recursively
   */
  private extractStringValues(obj: any): string[] {
    const strings: string[] = [];

    if (typeof obj === 'string') {
      strings.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        strings.push(...this.extractStringValues(item));
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        strings.push(...this.extractStringValues(value));
      }
    }

    return strings;
  }

  /**
   * Check if location is too granular (ward/county/district/postal code)
   * Requirements: 5.6, 5.7
   */
  isLocationTooGranular(input: string): boolean {
    const granularPatterns = [
      /\bward\b/i,
      /\bcounty\b/i,
      /\bdistrict\b/i,
      /\b\d{3}-\d{4}\b/, // Japanese postal code
      /\b\d{5}(-\d{4})?\b/, // US ZIP code
      /\d+.*street/i,
      /\d+.*avenue/i,
      /\d+.*road/i,
      // Japanese ward names
      /練馬区|渋谷区|世田谷区|新宿区|港区|中央区|千代田区/,
      // Common US county patterns
      /\b(Los Angeles|San Francisco|Manhattan|Brooklyn|Queens)\s+County\b/i
    ];

    return granularPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate location is not too granular and throw error if it is
   * Requirements: 5.6, 5.7
   */
  validateLocationGranularity(location: GeographicUnit): void {
    // Check if countyOrWard is present (too granular)
    if (location.countyOrWard) {
      throw new LocationTooGranularError(
        `Location too granular: ${location.countyOrWard}. Only prefecture/state level allowed.`
      );
    }

    // Check geographic area string for granular patterns
    const locationString = `${location.stateOrPrefecture}, ${location.country}`;
    if (this.isLocationTooGranular(locationString)) {
      throw new LocationTooGranularError(
        `Location contains granular information: ${locationString}`
      );
    }
  }
}
