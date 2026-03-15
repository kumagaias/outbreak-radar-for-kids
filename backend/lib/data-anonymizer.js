/**
 * DataAnonymizer - Validates and anonymizes data before Nova API calls
 * Acts as trust boundary to prevent PII transmission
 */

class DataAnonymizer {
  constructor() {
    // Whitelist of allowed values for structural validation
    this.ALLOWED_AGE_RANGES = ['0-1', '2-3', '4-6', '7+'];
    this.ALLOWED_RISK_LEVELS = ['high', 'medium', 'low'];
    this.ALLOWED_LANGUAGES = ['ja', 'en'];
    
    // Geographic area pattern: "Prefecture/State, Country Code"
    this.GEOGRAPHIC_AREA_PATTERN = /^[A-Za-z\s]+,\s[A-Z]{2}$/;
    
    // Patterns for detecting overly granular location data
    this.GRANULAR_LOCATION_PATTERNS = [
      /ward/i,
      /county/i,
      /district/i,
      /\d{3}-\d{4}/, // Postal code
      /\d+.*street/i,
      /city/i,
      /town/i,
      /village/i
    ];
  }

  /**
   * Validates that request contains no PII using whitelist approach
   * @param {Object} request - Request object to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateNoPII(request) {
    const errors = [];

    // Validate ageRange
    if (!request.ageRange || !this.ALLOWED_AGE_RANGES.includes(request.ageRange)) {
      errors.push(`Invalid ageRange: ${request.ageRange}. Must be one of: ${this.ALLOWED_AGE_RANGES.join(', ')}`);
    }

    // Validate geographicArea format
    if (!request.geographicArea || !this.GEOGRAPHIC_AREA_PATTERN.test(request.geographicArea)) {
      errors.push(`Invalid geographicArea format: ${request.geographicArea}. Expected format: "Prefecture/State, CC"`);
    }

    // Check for granular location data
    if (request.geographicArea && this.isLocationTooGranular(request.geographicArea)) {
      errors.push(`Location too granular: ${request.geographicArea}. Only prefecture/state level allowed`);
    }

    // Validate riskLevel
    if (!request.riskLevel || !this.ALLOWED_RISK_LEVELS.includes(request.riskLevel)) {
      errors.push(`Invalid riskLevel: ${request.riskLevel}. Must be one of: ${this.ALLOWED_RISK_LEVELS.join(', ')}`);
    }

    // Validate language
    if (!request.language || !this.ALLOWED_LANGUAGES.includes(request.language)) {
      errors.push(`Invalid language: ${request.language}. Must be one of: ${this.ALLOWED_LANGUAGES.join(', ')}`);
    }

    // Check for unexpected properties that might contain PII
    const allowedKeys = new Set([
      'ageRange', 'geographicArea', 'riskLevel', 'language', 
      'diseaseNames', 'outbreakData', 'nearbyHotspot'
    ]);

    for (const key of Object.keys(request)) {
      if (!allowedKeys.has(key)) {
        errors.push(`Unexpected property in request: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if location string contains granular data (ward/county/district)
   * @param {string} location - Location string to check
   * @returns {boolean} True if location is too granular
   */
  isLocationTooGranular(location) {
    return this.GRANULAR_LOCATION_PATTERNS.some(pattern => pattern.test(location));
  }

  /**
   * Anonymizes location to prefecture/state level only
   * @param {string} location - Location string (may contain ward/county)
   * @returns {string} Anonymized location (prefecture/state, country)
   */
  anonymizeLocation(location) {
    // Extract prefecture/state and country code
    // Input format: "Nerima Ward, Tokyo, JP" or "Tokyo, JP"
    // Output format: "Tokyo, JP"
    
    const parts = location.split(',').map(p => p.trim());
    
    if (parts.length >= 2) {
      // Take last two parts (state/prefecture and country)
      return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }
    
    return location;
  }

  /**
   * Filters outbreak data to optimize token cost and context window
   * @param {Array} outbreakData - Array of outbreak data objects
   * @param {string} targetRegion - Target prefecture/state
   * @returns {Array} Filtered outbreak data
   */
  filterOutbreakData(outbreakData, targetRegion) {
    if (!Array.isArray(outbreakData)) {
      return [];
    }

    // Extract prefecture/state from targetRegion
    const targetPrefecture = targetRegion.split(',')[0].trim();

    return outbreakData
      // Filter by region relevance
      .filter(outbreak => {
        if (!outbreak.geographicUnit) return false;
        const outbreakRegion = outbreak.geographicUnit.stateOrPrefecture || '';
        return outbreakRegion === targetPrefecture;
      })
      // Filter by severity (exclude low severity < 4)
      .filter(outbreak => outbreak.severity >= 4)
      // Sort by severity (highest first)
      .sort((a, b) => b.severity - a.severity)
      // Limit to top 5 outbreaks
      .slice(0, 5)
      // Remove unnecessary fields to reduce token usage
      .map(outbreak => ({
        diseaseName: outbreak.diseaseName,
        severity: outbreak.severity,
        affectedAgeRanges: outbreak.affectedAgeRanges
      }));
  }

  /**
   * Sanitizes log data to remove PII before logging
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data safe for logging
   */
  sanitizeForLogging(data) {
    const sanitized = { ...data };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['name', 'address', 'dateOfBirth', 'exactAge', 'email', 'phone'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    // Anonymize location if present
    if (sanitized.location) {
      sanitized.location = this.anonymizeLocation(sanitized.location);
    }
    
    if (sanitized.geographicArea) {
      sanitized.geographicArea = this.anonymizeLocation(sanitized.geographicArea);
    }
    
    return sanitized;
  }
}

module.exports = DataAnonymizer;
