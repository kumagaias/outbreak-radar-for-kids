# Requirements Document: Nova AI Recommendations

## Introduction

This feature integrates Amazon Nova Lite/Micro to provide personalized infectious disease risk assessments and actionable recommendations for parents of young children. The system analyzes outbreak data, child age, and geographic location to generate context-aware guidance that helps parents make informed decisions about childcare attendance and preventive measures.

The feature replaces the current mock recommendation system with AI-powered analysis while maintaining strict privacy standards (local-only data storage) and medical disclaimers (no diagnostic capabilities).

## Glossary

- **Nova_Service**: Amazon Nova Lite/Micro AI service for generating recommendations
- **Risk_Analyzer**: Component that evaluates outbreak data and child profile to determine risk level
- **Recommendation_Generator**: Component that produces actionable guidance based on risk analysis
- **Child_Profile**: User-provided information including child age range and geographic location
- **Outbreak_Data**: Current infectious disease data including disease type, severity level, and geographic distribution
- **Risk_Level**: Classification of infection risk as high, medium, or low
- **Action_Item**: Specific preventive measure recommended to the user
- **Local_Storage**: Device-only data storage (AsyncStorage) that never transmits to servers
- **Medical_Disclaimer**: Statement clarifying the app does not provide medical diagnosis
- **Feedback_UI**: User interface component for collecting feedback on recommendation usefulness
- **Geographic_Unit**: Geographic unit used for risk calculation and Nova_Service calls. In Japan, risk calculation is performed at ward level (e.g., Nerima Ward, Tokyo), and in the US at county level (e.g., Los Angeles County), while transmission to Nova_Service is limited to prefecture/state level

## Requirements

### Requirement 1: Generate Personalized Risk Assessment

**User Story:** As a parent, I want to receive a personalized risk assessment for my child, so that I can understand their specific infection risk based on age and location.

#### Acceptance Criteria

1. WHEN outbreak data and child profile are provided, THE Risk_Analyzer SHALL calculate a risk level within 3 seconds
2. THE Risk_Analyzer SHALL consider child age range in risk calculation
3. THE Risk_Analyzer SHALL consider geographic proximity of outbreaks in risk calculation
4. THE Risk_Analyzer SHALL consider disease severity levels in risk calculation
5. THE Risk_Analyzer SHALL return one of three risk levels: high, medium, or low
6. WHEN multiple high-severity outbreaks exist in the user area, THE Risk_Analyzer SHALL return high risk level
7. WHEN no high-severity outbreaks exist but medium-severity outbreaks are present, THE Risk_Analyzer SHALL return medium risk level
8. WHEN only low-severity outbreaks exist, THE Risk_Analyzer SHALL return low risk level
9. WHEN no outbreaks exist in the user area, THE Risk_Analyzer SHALL return low risk level

### Requirement 2: Generate Age-Appropriate Recommendations

**User Story:** As a parent, I want to receive recommendations appropriate for my child's age, so that I can take practical preventive actions.

#### Acceptance Criteria

1. WHEN generating recommendations for children aged 0-1 years, THE Recommendation_Generator SHALL include infant-specific guidance
2. WHEN generating recommendations for children aged 2-3 years, THE Recommendation_Generator SHALL include toddler-specific guidance
3. WHEN generating recommendations for children aged 4-6 years, THE Recommendation_Generator SHALL include preschool-specific guidance
4. WHEN generating recommendations for children aged 7+ years, THE Recommendation_Generator SHALL include school-age-specific guidance
5. THE Recommendation_Generator SHALL produce between 3 and 5 action items per recommendation
6. THE Recommendation_Generator SHALL use action-oriented language rather than fear-based language
7. THE Recommendation_Generator SHALL complete generation within 5 seconds

### Requirement 3: Integrate Nova AI Service

**User Story:** As a developer, I want to integrate Amazon Nova Lite/Micro, so that the app can generate intelligent recommendations.

#### Acceptance Criteria

1. THE Nova_Service SHALL accept structured input containing outbreak data and child profile
2. THE Nova_Service SHALL return structured output containing summary and action items
3. WHEN Nova_Service is unavailable, THE System SHALL fall back to rule-based recommendations
4. THE Nova_Service SHALL use a system prompt that enforces non-alarmist tone
5. THE Nova_Service SHALL use a system prompt that prohibits medical diagnosis language
6. THE Nova_Service SHALL include disease names in generated summaries
7. THE Nova_Service SHALL generate recommendations in the user selected language (Japanese or English)

### Requirement 4: Provide Childcare Attendance Guidance

**User Story:** As a working parent, I want clear guidance on whether to send my child to daycare, so that I can make informed attendance decisions quickly.

#### Acceptance Criteria

1. WHEN risk level is high, THE Recommendation_Generator SHALL include guidance about monitoring child health before attendance
2. WHEN risk level is high, THE Recommendation_Generator SHALL include specific symptoms to watch for
3. WHEN risk level is medium, THE Recommendation_Generator SHALL include preventive measures for attendance
4. WHEN risk level is low, THE Recommendation_Generator SHALL indicate normal attendance is appropriate
5. THE Recommendation_Generator SHALL display cached recommendations within 3 seconds for morning routine use
6. WHEN risk level is high, THE Recommendation_Generator SHALL include guidance considering common Japanese daycare attendance standards (such as 37.5°C temperature threshold)
7. WHERE user language is Japanese, THE Recommendation_Generator MAY include guidance that caution is needed even below 37.5°C if the child appears different from usual

### Requirement 5: Maintain Privacy Standards

**User Story:** As a privacy-conscious parent, I want my child's information to stay on my device, so that their personal data is not transmitted to servers.

#### Acceptance Criteria

1. THE System SHALL store child profile data only in Local_Storage
2. THE System SHALL NOT transmit child age to external servers
3. THE System SHALL NOT transmit geographic location to external servers beyond what is required for outbreak data retrieval
4. THE Risk_Analyzer SHALL use ward-level location information in Japan and county-level location information in the US to perform risk calculation
5. WHEN calling Nova_Service, THE System SHALL pass only age range (0-1 years, 2-3 years, 4-6 years, 7+ years) and geographic area (prefecture/state level)
6. WHEN calling Nova_Service, THE System SHALL NOT pass personally identifiable information (name, address, date of birth)
7. THE System SHALL NOT pass location information more detailed than ward level in Japan or county level in the US to Nova_Service
8. THE System SHALL NOT persist conversation history with Nova_Service

### Requirement 6: Display Medical Disclaimers

**User Story:** As a responsible app provider, I want to display medical disclaimers, so that users understand the app does not provide medical diagnosis.

#### Acceptance Criteria

1. THE System SHALL display Medical_Disclaimer on all recommendation screens
2. THE Medical_Disclaimer SHALL state the app is not a medical device
3. THE Medical_Disclaimer SHALL state the app is for informational purposes only
4. THE Medical_Disclaimer SHALL recommend consulting healthcare providers for medical concerns
5. THE Medical_Disclaimer SHALL be visible without requiring user interaction

### Requirement 7: Handle Service Failures Gracefully

**User Story:** As a user, I want the app to work even when AI services are unavailable, so that I can still access basic recommendations.

#### Acceptance Criteria

1. WHEN Nova_Service fails to respond within 5 seconds, THE System SHALL use fallback recommendations
2. WHEN Nova_Service returns an error, THE System SHALL use fallback recommendations
3. THE System SHALL log service failures for monitoring
4. THE System SHALL NOT display error messages that alarm users
5. WHEN using fallback recommendations, THE System SHALL provide the same risk level calculation as AI-powered mode

### Requirement 8: Support Multi-Language Output

**User Story:** As a user, I want recommendations in my preferred language, so that I can understand guidance clearly.

#### Acceptance Criteria

1. WHEN user language is Japanese, THE Recommendation_Generator SHALL produce Japanese text
2. WHEN user language is English, THE Recommendation_Generator SHALL produce English text
3. WHEN user language is Japanese, THE Recommendation_Generator SHALL use polite form (desu/masu style)
4. WHEN user language is English, THE Recommendation_Generator SHALL use declarative sentences
5. THE Recommendation_Generator SHALL maintain consistent tone across languages

### Requirement 9: Optimize for Morning Routine Usage

**User Story:** As a busy parent, I want to check recommendations quickly in the morning, so that I can make decisions without delay.

#### Acceptance Criteria

1. WHEN risk level is low, THE System SHALL display summary in 10 seconds or less
2. THE System SHALL fetch outbreak data and call Nova_Service on app startup to cache recommendations
3. THE System SHALL display cached recommendation timestamp
4. WHEN cached data is older than 24 hours, THE System SHALL indicate data staleness
5. THE System SHALL prioritize loading recommendation over other app features
6. WHEN outbreak data has changed since last fetch, THE System SHALL generate new recommendations
7. THE System SHALL display the timestamp of outbreak data used to generate cached recommendations

### Requirement 10: Generate Actionable Prevention Steps

**User Story:** As a parent, I want specific actions I can take, so that I know how to protect my child from infection.

#### Acceptance Criteria

1. THE Recommendation_Generator SHALL produce action items that are behaviorally specific
2. THE Recommendation_Generator SHALL avoid vague terms like "be careful" or "stay safe"
3. WHEN risk level is high, THE Recommendation_Generator SHALL include at least one hygiene-related action
4. WHEN risk level is high, THE Recommendation_Generator SHALL include at least one monitoring-related action
5. THE Recommendation_Generator SHALL prioritize actions by effectiveness and practicality

### Requirement 11: Provide Visual Risk Display

**User Story:** As a busy parent, I want to understand risk level intuitively before reading text, so that I can make quick decisions during limited morning time.

#### Acceptance Criteria

1. THE System SHALL display visual indicators corresponding to risk level (high, medium, low)
2. WHEN risk level is high, THE System SHALL use red-based visual display
3. WHEN risk level is medium, THE System SHALL use yellow-based visual display
4. WHEN risk level is low, THE System SHALL use green-based visual display
5. THE System SHALL display visual indicators before text information
6. THE System SHALL display action items in checklist format

### Requirement 12: Collect User Feedback

**User Story:** As a product developer, I want to measure the usefulness of recommendations, so that I can improve Nova AI system prompts.

#### Acceptance Criteria

1. THE System SHALL provide a simple feedback UI asking "Was this information helpful?" after displaying recommendations
2. THE Feedback_UI SHALL allow users to respond with "Yes" or "No" options
3. THE System SHALL save feedback data to Local_Storage
4. WHERE user consent is obtained, THE System MAY send anonymized feedback data to server
5. THE System SHALL use opt-in approach for feedback transmission
6. THE System SHALL NOT include personally identifiable information in feedback data
