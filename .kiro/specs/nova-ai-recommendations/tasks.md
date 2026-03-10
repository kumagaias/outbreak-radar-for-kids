# Implementation Plan: Nova AI Recommendations

## Overview

This implementation plan converts the Nova AI Recommendations design into discrete coding tasks. The feature integrates Amazon Nova Lite/Micro to provide personalized infectious disease risk assessments for parents of young children. Implementation focuses on privacy-first architecture, performance optimization (3s cached, 5s new generation), and graceful degradation with fallback templates.

Key technical challenges:
- Geographic fallback logic (ward/county → prefecture/state → national)
- Nova Lite/Micro model selection based on risk level
- Privacy validation (no PII transmission)
- Property-based testing with fast-check (26 properties)
- Cultural sensitivity (Japanese 37.5°C threshold, polite language)

## Tasks

- [ ] 1. Set up project structure and core interfaces
  - Create directory structure: `mobile/lib/ai-recommendations/` with subdirectories for components, types, utils
  - Define TypeScript interfaces for all data models (ChildProfile, OutbreakData, Recommendation, RiskLevel, etc.)
  - Set up fast-check testing framework with PBT_CONFIG (100 iterations, 10s timeout)
  - Create test generators (arbitraries) for OutbreakData, ChildProfile, GeographicUnit, AgeRange
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1-2.7, 3.1-3.7, 5.1-5.8_

- [ ] 2. Implement error classes
  - Define NovaTimeoutError class
  - Define NovaServiceError class
  - Define PIIDetectedError class
  - Define LocationTooGranularError class
  - Define OutbreakAPITimeout class
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 3. Implement GeographicNormalizer utility
  - Create GeographicNormalizer class with normalize method
  - Implement JIS code mapping for Japanese municipalities (prefecture + ward/county)
  - Implement FIPS code mapping for US counties (state + county)
  - Implement fuzzy matching fallback for unrecognized location strings
  - Update GeographicUnit interface to include jisCode and fipsCode fields
  - _Requirements: 1.3, 5.4_

- [ ] 4. Implement Risk_Analyzer component
  - [ ] 4.1 Create Risk_Analyzer class with calculateRiskLevel method
    - Implement geographic filtering with fallback logic (exact match → prefecture/state → national with 0.5x factor)
    - Implement age-based susceptibility weights (0-1: 1.5x respiratory, 2-3: 1.3x HFMD, 4-6: 1.0x, 7+: 0.9x)
    - Implement severity threshold logic (high: ≥7/10, medium: 4-6/10, low: ≤3/10)
    - Return RiskLevel enum (HIGH, MEDIUM, LOW)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 5.4_
  
  - [ ]* 4.2 Write property test for Risk_Analyzer performance
    - **Property 1: Risk Level Calculation Performance**
    - **Validates: Requirements 1.1**
  
  - [ ]* 4.3 Write property test for risk level output constraint
    - **Property 2: Risk Level Output Constraint**
    - **Validates: Requirements 1.5**
  
  - [ ]* 4.4 Write property test for severity-based risk classification
    - **Property 3: Severity-Based Risk Classification**
    - **Validates: Requirements 1.6, 1.7, 1.8, 1.9**
  
  - [ ]* 4.5 Write property test for age range influence
    - **Property 4: Age Range Influence on Risk**
    - **Validates: Requirements 1.2**
  
  - [ ]* 4.6 Write property test for geographic proximity influence
    - **Property 5: Geographic Proximity Influence on Risk**
    - **Validates: Requirements 1.3**
  
  - [ ]* 4.7 Write property test for disease severity influence
    - **Property 6: Disease Severity Influence on Risk**
    - **Validates: Requirements 1.4**
  
  - [ ]* 4.8 Write unit tests for Risk_Analyzer edge cases
    - Test empty outbreak data (should return LOW)
    - Test high-severity outbreak in user area (should return HIGH)
    - Test prefecture fallback when ward data unavailable
    - Test national fallback with 0.5x risk reduction
    - _Requirements: 1.6, 1.7, 1.8, 1.9_

- [ ] 5. Checkpoint - Ensure Risk_Analyzer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Nova_Service wrapper
  - [ ] 6.1 Create NovaService class with callNova method
    - Implement 5-second timeout with AbortController
    - Implement model selection (NovaModel.LITE vs NovaModel.MICRO)
    - Handle NovaTimeoutError and NovaServiceError
    - Parse structured JSON response (summary + actionItems)
    - Track latency metrics
    - _Requirements: 3.1, 3.2, 3.3, 7.1, 7.2_
  
  - [ ]* 6.2 Write property test for structured output format
    - **Property 11: Structured Output Format**
    - **Validates: Requirements 3.2**
  
  - [ ]* 6.3 Write unit tests for Nova_Service error handling
    - Test timeout after 5 seconds (should throw NovaTimeoutError)
    - Test API error response (should throw NovaServiceError)
    - Test successful response parsing
    - Test model selection logic
    - _Requirements: 3.1, 3.2, 7.1, 7.2_

- [ ] 7. Implement system prompt templates
  - [ ] 7.1 Create system prompt generator for Japanese
    - Include role definition (childcare advisor)
    - Include tone requirements (calm, supportive, polite です・ます調)
    - Include prohibited terms (dangerous, urgent, emergency, diagnosis)
    - Include output format specification (JSON with summary + actionItems)
    - Include context variables (ageRange, prefecture/state, diseaseNames, riskLevel)
    - _Requirements: 2.6, 3.4, 3.5, 3.6, 3.7, 8.1, 8.3_
  
  - [ ] 7.2 Create system prompt generator for English
    - Include role definition (childcare advisor)
    - Include tone requirements (calm, supportive, declarative sentences)
    - Include prohibited terms (dangerous, urgent, emergency, diagnosis)
    - Include output format specification (JSON with summary + actionItems)
    - Include context variables (ageRange, state, diseaseNames, riskLevel)
    - _Requirements: 2.6, 3.4, 3.5, 3.6, 3.7, 8.2, 8.4_
  
  - [ ]* 7.3 Write property test for non-alarmist tone
    - **Property 12: Non-Alarmist Tone**
    - **Validates: Requirements 3.4**
  
  - [ ]* 7.4 Write property test for medical diagnosis prohibition
    - **Property 13: Medical Diagnosis Prohibition**
    - **Validates: Requirements 3.5**
  
  - [ ]* 7.5 Write property test for disease name inclusion
    - **Property 14: Disease Name Inclusion**
    - **Validates: Requirements 3.6**
  
  - [ ]* 7.6 Write property test for language output matching
    - **Property 15: Language Output Matching**
    - **Validates: Requirements 3.7, 8.1, 8.2**
  
  - [ ]* 7.7 Write property test for Japanese polite form
    - **Property 16: Japanese Polite Form**
    - **Validates: Requirements 8.3**

- [ ] 8. Implement fallback templates
  - [ ] 8.1 Create fallback template system
    - Define FALLBACK_TEMPLATES object with HIGH_RISK_JAPANESE, HIGH_RISK_ENGLISH, MEDIUM_RISK_JAPANESE, MEDIUM_RISK_ENGLISH, LOW_RISK_JAPANESE, LOW_RISK_ENGLISH
    - Implement template variable substitution ({diseaseNames}, {area})
    - Ensure templates match AI tone (non-alarmist, action-oriented)
    - Include Japanese 37.5°C threshold in HIGH_RISK_JAPANESE template
    - _Requirements: 3.3, 4.6, 7.1, 7.2, 7.5_
  
  - [ ]* 8.2 Write property test for fallback on service failure
    - **Property 20: Fallback on Service Failure**
    - **Validates: Requirements 7.1, 7.2, 7.5**
  
  - [ ]* 8.3 Write unit tests for fallback templates
    - Test template variable substitution
    - Test Japanese template includes 37.5°C threshold
    - Test English template includes 99.5°F threshold
    - Test fallback templates match AI tone
    - _Requirements: 4.6, 7.1, 7.2, 7.5_

- [ ] 9. Checkpoint - Ensure Nova_Service and templates work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Recommendation_Generator component
  - [ ] 10.1 Create RecommendationGenerator class with generateRecommendation method
    - Implement model selection logic (LOW risk → MICRO, MEDIUM/HIGH → LITE)
    - Implement data anonymization (age range only, prefecture/state only)
    - Call Nova_Service with system prompt and anonymized data
    - Fall back to templates on timeout/error
    - Validate output structure (summary + 3-5 actionItems)
    - Track generation source (nova-lite, nova-micro, fallback)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.7, 4.1, 4.2, 4.3, 4.4, 5.5, 5.6, 7.1, 7.2, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 10.2 Write property test for age-appropriate guidance
    - **Property 7: Age-Appropriate Guidance Generation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  
  - [ ]* 10.3 Write property test for action item count constraint
    - **Property 8: Action Item Count Constraint**
    - **Validates: Requirements 2.5**
  
  - [ ]* 10.4 Write property test for action-oriented language
    - **Property 9: Action-Oriented Language**
    - **Validates: Requirements 2.6**
  
  - [ ]* 10.5 Write property test for recommendation generation performance
    - **Property 10: Recommendation Generation Performance**
    - **Validates: Requirements 2.7**
  
  - [ ]* 10.6 Write property test for risk-appropriate guidance content
    - **Property 17: Risk-Appropriate Guidance Content**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  
  - [ ]* 10.7 Write property test for behaviorally specific actions
    - **Property 24: Behaviorally Specific Actions**
    - **Validates: Requirements 10.1, 10.2**
  
  - [ ]* 10.8 Write property test for high risk content requirements
    - **Property 25: High Risk Content Requirements**
    - **Validates: Requirements 10.3, 10.4**
  
  - [ ]* 10.9 Write unit tests for Recommendation_Generator
    - Test model selection (LOW → MICRO, MEDIUM/HIGH → LITE)
    - Test fallback on Nova timeout
    - Test fallback on Nova error
    - Test output validation (3-5 action items)
    - Test Japanese output includes です・ます
    - _Requirements: 2.5, 2.6, 2.7, 3.3, 7.1, 7.2, 8.3_
  
  - [ ]* 10.10 Write unit tests for SafetyValidator
    - Test validateSafety detects medical diagnosis phrases (疑いがあります, suspected of, diagnosed with, has [disease])
    - Test validateSafety allows safe recommendations without diagnosis phrases
    - Test validateSafety blocks recommendations with "お子様は.*です" pattern
    - Test validateSafety blocks recommendations with "your child has" pattern
    - _Requirements: 3.5_

- [ ] 11. Implement privacy validation
  - [ ] 11.1 Create DataAnonymizer class
    - Implement anonymizeForNovaService method (age range + prefecture/state only)
    - Implement validateNoPII method with regex patterns for PII detection
    - Implement isLocationTooGranular method (detect ward/county/district/postal code)
    - Throw PIIDetectedError if PII found in payload
    - Throw LocationTooGranularError if location too detailed
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_
  
  - [ ]* 11.2 Write property test for privacy data transmission restriction
    - **Property 19: Privacy Data Transmission Restriction**
    - **Validates: Requirements 5.2, 5.3, 5.5, 5.6, 5.7**
  
  - [ ]* 11.3 Write unit tests for privacy validation
    - Test exact age is not transmitted (3.5 years → 2-3 years)
    - Test child name is not transmitted
    - Test ward/county is not transmitted (Nerima Ward → Tokyo)
    - Test date of birth is not transmitted
    - Test address is not transmitted
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 5.7_

- [ ] 12. Checkpoint - Ensure privacy validation works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement Cache_Manager component
  - [ ] 13.1 Create CacheManager class with caching logic
    - Implement getCachedRecommendation method (read from AsyncStorage)
    - Implement setCachedRecommendation method (write to AsyncStorage)
    - Implement 24-hour TTL check (isStale flag)
    - Implement cache key generation (ageRange + prefecture/state)
    - Implement invalidateCache method
    - Track outbreak data timestamp for staleness detection
    - _Requirements: 4.5, 9.2, 9.3, 9.4, 9.6, 9.7_
  
  - [ ]* 13.2 Write property test for cached recommendation performance
    - **Property 18: Cached Recommendation Performance**
    - **Validates: Requirements 4.5**
  
  - [ ]* 13.3 Write property test for cache invalidation on data change
    - **Property 23: Cache Invalidation on Data Change**
    - **Validates: Requirements 9.6**
  
  - [ ]* 13.4 Write unit tests for Cache_Manager
    - Test cache hit returns data within 3 seconds
    - Test cache miss returns null
    - Test cache expiration after 24 hours (isStale = true)
    - Test cache invalidation when outbreak data timestamp changes
    - Test cache key generation (same key for same ageRange + prefecture)
    - _Requirements: 4.5, 9.2, 9.3, 9.4, 9.6_

- [ ] 14. Implement background pre-generation
  - [ ] 14.1 Create AppInitializer class for startup flow
    - Implement initialize method that starts background tasks
    - Implement prefetchOutbreakData method (fetch latest outbreak data)
    - Implement pregenerateRecommendations method (generate and cache)
    - Ensure background tasks don't block UI rendering
    - Log errors but don't fail app startup
    - _Requirements: 9.2, 9.5_
  
  - [ ]* 14.2 Write integration test for background pre-generation
    - Test app startup triggers background generation
    - Test cache is populated after background generation
    - Test UI renders before background tasks complete
    - _Requirements: 9.2, 9.5_

- [ ] 15. Implement UI components
  - [ ] 15.1 Create RiskIndicator component
    - Display visual indicator based on risk level (red/yellow/green)
    - Use red-based colors for HIGH risk
    - Use yellow-based colors for MEDIUM risk
    - Use green-based colors for LOW risk
    - Display before text content
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [ ] 15.2 Create RecommendationContent component
    - Display summary text
    - Display action items in checklist format
    - Display recommendation timestamp
    - Display outbreak data timestamp
    - Display staleness warning if data > 24 hours old
    - _Requirements: 9.3, 9.4, 9.7, 11.6_
  
  - [ ] 15.3 Create LoadingMessage component for intermediate UI
    - Display risk level indicator immediately (< 3s)
    - Display "Generating personalized guidance..." message
    - Replace with full recommendation when Nova responds
    - _Requirements: 2.7, 4.5, 9.1_
  
  - [ ] 15.4 Create MedicalDisclaimer component
    - Display disclaimer on all recommendation screens
    - State app is not a medical device
    - State app is for informational purposes only
    - Recommend consulting healthcare providers
    - Make visible without user interaction
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 15.5 Write unit tests for UI components
    - Test RiskIndicator displays correct colors for each risk level
    - Test RecommendationContent displays checklist format
    - Test LoadingMessage displays during generation
    - Test MedicalDisclaimer is always visible
    - _Requirements: 6.1, 6.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 16. Implement Feedback_Collector component
  - [ ] 16.1 Create FeedbackCollector class
    - Implement saveFeedback method (save to AsyncStorage)
    - Implement feedback pruning (max 100 items, 30 days retention)
    - Implement hasUserConsent method (check consent flag)
    - Implement requestConsent method (show consent dialog)
    - Implement sendAnonymizedFeedback method (optional server transmission)
    - Ensure no PII in feedback data (only riskLevel, ageRange, language, source)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [ ] 16.2 Create FeedbackUI component
    - Display "Was this information helpful?" question
    - Provide "Yes" and "No" buttons
    - Save feedback on button click
    - Display after recommendation content
    - _Requirements: 12.1, 12.2_
  
  - [ ]* 16.3 Write property test for feedback data privacy
    - **Property 26: Feedback Data Privacy**
    - **Validates: Requirements 12.6**
  
  - [ ]* 16.4 Write unit tests for Feedback_Collector
    - Test feedback is saved to AsyncStorage
    - Test feedback pruning after 30 days
    - Test feedback pruning after 100 items
    - Test no PII in feedback data
    - Test consent check before server transmission
    - _Requirements: 12.3, 12.4, 12.5, 12.6_

- [ ] 17. Checkpoint - Ensure UI and feedback components work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Implement user-facing error messages and logging
  - [ ] 18.1 Create user-facing error messages
    - Define USER_ERROR_MESSAGES object with GENERAL_ERROR, STALE_DATA, NO_OUTBREAK_DATA
    - Ensure messages are non-alarmist (no "failed", "error", "broken")
    - Provide Japanese and English versions
    - _Requirements: 7.4_
  
  - [ ] 18.2 Create logging utility
    - Implement log function with levels (ERROR, WARN, INFO, DEBUG)
    - Sanitize logs to remove PII before logging
    - Log service failures, cache operations, performance metrics
    - _Requirements: 7.3_
  
  - [ ]* 18.3 Write property test for non-alarming error messages
    - **Property 21: Non-Alarming Error Messages**
    - **Validates: Requirements 7.4**
  
  - [ ]* 18.4 Write unit tests for user-facing error messages
    - Test GENERAL_ERROR message is non-alarmist (no "failed", "error", "broken")
    - Test STALE_DATA message is informative and calm
    - Test NO_OUTBREAK_DATA message is helpful and non-alarming
    - Test Japanese and English versions exist for all messages
    - _Requirements: 7.4_

- [ ] 19. Implement performance optimization
  - [ ] 19.1 Create ModelSelector class
    - Implement selectModel method (LOW + simple → MICRO, else → LITE)
    - Implement calculateOutbreakComplexity method (disease count + severity variance)
    - _Requirements: 2.7, 9.1_
  
  - [ ] 19.2 Create CostTracker class (optional)
    - Track Nova Lite calls, Nova Micro calls, fallback usage
    - Calculate estimated cost per call
    - Save metrics to AsyncStorage
    - _Requirements: None (future enhancement)_
  
  - [ ]* 19.3 Write property test for low risk display performance
    - **Property 22: Low Risk Display Performance**
    - **Validates: Requirements 9.1**
  
  - [ ]* 19.4 Write integration test for end-to-end performance
    - Test cached recommendation displays within 3 seconds
    - Test new recommendation generates within 5 seconds
    - Test background pre-generation completes before user opens screen
    - _Requirements: 2.7, 4.5, 9.1, 9.2_

- [ ] 20. Integrate components into RecommendationScreen
  - [ ] 20.1 Create RecommendationScreen component
    - Implement componentDidMount lifecycle (check cache, generate if needed)
    - Implement progressive loading (show risk level first, then full recommendation)
    - Wire Risk_Analyzer, Recommendation_Generator, Cache_Manager, Feedback_Collector
    - Display RiskIndicator, RecommendationContent, MedicalDisclaimer, FeedbackUI
    - Handle loading states and errors gracefully
    - _Requirements: All requirements_
  
  - [ ]* 20.2 Write integration test for full recommendation flow
    - Test app startup → background generation → cache population
    - Test user opens screen → cache hit → display within 3 seconds
    - Test cache miss → generate new → display within 5 seconds
    - Test Nova timeout → fallback → display recommendation
    - Test feedback submission → save to AsyncStorage
    - _Requirements: All requirements_

- [ ] 21. Replace mock implementation
  - [ ] 21.1 Update mobile/lib/ai-recommendations.ts
    - Remove mock implementation
    - Import and export new components (Risk_Analyzer, Recommendation_Generator, etc.)
    - Update exports to match existing API
    - _Requirements: All requirements_
  
  - [ ] 21.2 Update app initialization
    - Add AppInitializer.initialize() call to app startup
    - Ensure background pre-generation starts immediately
    - _Requirements: 9.2, 9.5_

- [ ] 22. Final checkpoint - Ensure all tests pass
  - Run all unit tests and property-based tests
  - Verify 60%+ code coverage
  - Ensure all 26 properties pass with 100+ iterations
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check with 100 iterations per property
- All PII must stay on device (exact age, name, address, date of birth, ward/county)
- Nova calls use only age range (0-1, 2-3, 4-6, 7+) and prefecture/state
- Japanese output must use polite form (です・ます調)
- Performance targets: 3s cached display, 5s new generation
- Fallback templates must match AI tone (non-alarmist, action-oriented)
- Medical disclaimers must be visible on all recommendation screens
