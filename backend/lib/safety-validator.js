/**
 * SafetyValidator - Validates AI-generated recommendations for safety
 * 
 * **Validates: Requirements 13.8, 13.9, 3.4, 3.5**
 * 
 * Implements "Suspicious is fallback" principle:
 * Any uncertainty triggers fallback to ensure user safety.
 * 
 * Validation checks:
 * 1. Medical diagnosis phrases (禁止)
 * 2. Alarmist language (危険, emergency, crisis)
 * 3. Temperature thresholds (37.5°C for Japanese, 99.5°F for English)
 * 4. Age-appropriate guidance (no "gargle" for infants)
 */

class SafetyValidator {
  constructor() {
    // Medical diagnosis patterns (STRICT ENFORCEMENT)
    this.DIAGNOSIS_PATTERNS = [
      /疑いがあります/gi,
      /suspected of/gi,
      /diagnosed with/gi,
      /has [a-z\s]+ disease/gi,
      /お子様は.*です/gi,
      /your child has/gi
    ];
    
    // Alarmist language patterns (STRICT ENFORCEMENT)
    this.ALARMIST_PATTERNS = [
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
    this.TEMPERATURE_CONSTRAINTS = {
      celsius: { min: 36.0, max: 42.0, threshold: 37.5 },
      fahrenheit: { min: 96.8, max: 107.6, threshold: 99.5 }
    };
  }

  /**
   * Validates recommendation for safety
   * @param {Object} recommendation - Recommendation object
   * @param {Object} childProfile - Child profile with ageRange
   * @returns {boolean} True if safe, false if validation fails
   */
  validateSafety(recommendation, childProfile = null) {
    const fullText = recommendation.summary + ' ' + recommendation.actionItems.join(' ');
    
    // STRICT VALIDATION: "Suspicious is fallback" principle
    // Any uncertainty triggers fallback to ensure user safety
    
    // Check for medical diagnosis phrases
    if (!this.validateNoDiagnosisPhrases(fullText)) {
      return false;
    }
    
    // Check for alarmist language
    if (!this.validateNoAlarmistLanguage(fullText)) {
      return false;
    }
    
    // Check for numeric constraint violations (temperature thresholds)
    if (!this.validateTemperatureThresholds(fullText)) {
      return false;
    }
    
    // Check for age-inappropriate guidance (if child profile provided)
    if (childProfile && !this.validateAgeAppropriateness(fullText, childProfile)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validates that recommendation does not contain medical diagnosis phrases
   * @param {string} text - Full recommendation text
   * @returns {boolean} True if no diagnosis phrases found
   */
  validateNoDiagnosisPhrases(text) {
    for (const pattern of this.DIAGNOSIS_PATTERNS) {
      if (pattern.test(text)) {
        console.error('Safety validation failed: Medical diagnosis phrase detected', {
          pattern: pattern.source,
          text: text.substring(0, 100) // Log first 100 chars for debugging
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Validates that recommendation does not contain alarmist language
   * @param {string} text - Full recommendation text
   * @returns {boolean} True if no alarmist language found
   */
  validateNoAlarmistLanguage(text) {
    for (const pattern of this.ALARMIST_PATTERNS) {
      if (pattern.test(text)) {
        console.error('Safety validation failed: Alarmist language detected', {
          pattern: pattern.source
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Validates temperature thresholds are within valid ranges
   * @param {string} text - Full recommendation text
   * @returns {boolean} True if all temperature values are valid
   */
  validateTemperatureThresholds(text) {
    // Extract temperature values with units
    const celsiusPattern = /(\d+\.?\d*)\s*°?C/gi;
    const fahrenheitPattern = /(\d+\.?\d*)\s*°?F/gi;
    
    // Check Celsius values
    const celsiusMatches = [...text.matchAll(celsiusPattern)];
    for (const match of celsiusMatches) {
      const temp = parseFloat(match[1]);
      if (temp < this.TEMPERATURE_CONSTRAINTS.celsius.min || 
          temp > this.TEMPERATURE_CONSTRAINTS.celsius.max) {
        console.error(`Safety validation failed: Invalid Celsius temperature: ${temp}°C`);
        return false;
      }
      
      // Warn if threshold is not 37.5°C for Japanese context
      if (text.includes('登園') || text.includes('保育園')) {
        if (Math.abs(temp - this.TEMPERATURE_CONSTRAINTS.celsius.threshold) > 0.5) {
          console.warn(`Non-standard Japanese fever threshold: ${temp}°C (expected 37.5°C)`);
        }
      }
    }
    
    // Check Fahrenheit values
    const fahrenheitMatches = [...text.matchAll(fahrenheitPattern)];
    for (const match of fahrenheitMatches) {
      const temp = parseFloat(match[1]);
      if (temp < this.TEMPERATURE_CONSTRAINTS.fahrenheit.min || 
          temp > this.TEMPERATURE_CONSTRAINTS.fahrenheit.max) {
        console.error(`Safety validation failed: Invalid Fahrenheit temperature: ${temp}°F`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validates age-appropriate guidance
   * @param {string} text - Full recommendation text
   * @param {Object} childProfile - Child profile with ageRange
   * @returns {boolean} True if guidance is age-appropriate
   */
  validateAgeAppropriateness(text, childProfile) {
    // Infant (0-1 years) should not have instructions requiring child action
    // Note: This validation checks for instructions directed AT the child, not caregivers
    // "保護者が手洗いを徹底" (caregivers wash hands) is acceptable
    // "手洗いをしましょう" (child should wash hands) is not acceptable for infants
    if (childProfile.ageRange === '0-1') {
      const infantInappropriatePatterns = [
        /うがいをし/gi, // "do gargling" (action instruction)
        /手洗いをし/gi, // "do handwashing" (action instruction)
        /gargle/gi,
        /wash.*your.*hands/gi, // "wash your hands" (directed at child)
        /rinse.*mouth/gi
      ];
      
      for (const pattern of infantInappropriatePatterns) {
        if (pattern.test(text)) {
          console.error('Safety validation failed: Age-inappropriate guidance for infant', {
            pattern: pattern.source,
            ageRange: childProfile.ageRange
          });
          return false;
        }
      }
    }
    
    return true;
  }
}

module.exports = SafetyValidator;
