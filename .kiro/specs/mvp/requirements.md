# Requirements Document: Nova AI Recommendations

## Introduction

This feature integrates Amazon Nova Lite/Micro to provide personalized infectious disease risk assessments and actionable recommendations for parents of young children. The system analyzes outbreak data, child age, and geographic location to generate context-aware guidance that helps parents make informed decisions about childcare attendance and preventive measures.

The feature replaces the current mock recommendation system with AI-powered analysis while maintaining strict privacy standards (local-only data storage) and medical disclaimers (no diagnostic capabilities).

**Note on AI Model Usage**: This system uses Amazon Nova Lite/Micro exclusively for text-based recommendation generation. If additional AI services (such as Google Gemini for image generation or UI assets) are used in other parts of the application, those integrations are separate from this feature and should be documented independently.

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
- **Outbreak_Data_Fetcher**: Component that retrieves real-time infectious disease data from CDC NWSS, WastewaterSCAN, CDC NHSN, and Delphi Epidata APIs
- **SODA_API**: Socrata Open Data API used by data.cdc.gov for programmatic data access
- **Delphi_Epidata_API**: CMU Delphi's API providing access to FluView (ILI surveillance) and FluSurv-NET (hospitalization surveillance) data
- **CDC_NHSN**: National Healthcare Safety Network providing weekly hospital respiratory data including influenza and COVID-19 admissions by state
- **FluView_ILINet**: CDC's Outpatient Influenza-like Illness Surveillance Network tracking ILI percentage by age group and geographic region
- **FluSurv_NET**: CDC's Influenza Hospitalization Surveillance Network providing age-stratified hospitalization rates for laboratory-confirmed influenza

## Requirements

### Requirement 1: Generate Personalized Risk Assessment

**User Story:** As a parent, I want to receive a personalized risk assessment for my child, so that I can understand their specific infection risk based on age and location.

#### Acceptance Criteria

1. WHEN outbreak data is available (cached or fresh), THE Risk_Analyzer SHALL calculate a risk level within 3 seconds
2. THE Risk_Analyzer SHALL consider child age range in risk calculation
3. THE Risk_Analyzer SHALL consider geographic proximity of outbreaks in risk calculation
4. THE Risk_Analyzer SHALL consider disease severity levels in risk calculation
5. THE Risk_Analyzer SHALL consider temporal trends in outbreak data (increasing vs. decreasing) in risk calculation
6. WHEN wastewater viral activity shows upward trend, THE Risk_Analyzer SHALL increase weight of wastewater data in severity calculation (wastewater is a leading indicator, 1-2 weeks ahead of hospitalizations)
7. THE Risk_Analyzer SHALL return one of three risk levels: high, medium, or low
8. WHEN multiple high-severity outbreaks exist in the user area, THE Risk_Analyzer SHALL return high risk level
9. WHEN no high-severity outbreaks exist but medium-severity outbreaks are present, THE Risk_Analyzer SHALL return medium risk level
10. WHEN only low-severity outbreaks exist, THE Risk_Analyzer SHALL return low risk level
11. WHEN no outbreaks exist in the user area, THE Risk_Analyzer SHALL return low risk level

### Requirement 2: Generate Age-Appropriate Recommendations

**User Story:** As a parent, I want to receive recommendations appropriate for my child's age, so that I can take practical preventive actions.

#### Acceptance Criteria

1. WHEN generating recommendations for children aged 0-1 years, THE Recommendation_Generator SHALL include infant-specific guidance
2. WHEN generating recommendations for children aged 2-3 years, THE Recommendation_Generator SHALL include toddler-specific guidance
3. WHEN generating recommendations for children aged 4-6 years, THE Recommendation_Generator SHALL include preschool-specific guidance
4. WHEN generating recommendations for children aged 7+ years, THE Recommendation_Generator SHALL include school-age-specific guidance
5. THE Recommendation_Generator SHALL produce between 3 and 5 action items per recommendation
6. THE Recommendation_Generator SHALL use action-oriented language rather than fear-based language
7. THE Recommendation_Generator SHALL complete generation within 5 seconds, OR display fallback immediately and replace with AI-generated content when ready (optimistic UI)

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
8. WHEN user language is Japanese, THE Nova_Service system prompt SHALL reference Japan's Ministry of Health, Labour and Welfare "Infection Control Guidelines for Childcare Facilities" principles (e.g., 24-hour post-fever observation, medical clearance requirements)
   - Note: To prevent token explosion with Nova Micro, consider implementing dynamic prompt construction where Lambda extracts only relevant guideline excerpts based on detected disease names before calling Nova API. This RAG-like approach maintains prompt quality while reducing token consumption. Full implementation is post-MVP, but prompt structure should accommodate future enhancement.
9. THE System SHALL store prompts in AWS Systems Manager Parameter Store for MVP, with Lambda environment variable pointing to parameter name
   - Note: Parameter Store provides versioning and secure access without additional cost. Lambda retrieves prompt at runtime using boto3. Migration to Bedrock Prompt Management MAY be considered post-MVP for advanced features like A/B testing
10. THE Nova_Service system prompt SHALL specify strict JSON output format with required fields (summary: string, actionItems: string[])
11. THE Backend API SHALL validate Nova API responses against JSON schema before returning to client
12. THE System SHALL implement prompt versioning in Parameter Store using path format `/prompts/v1/ja` and `/prompts/v1/en` to enable A/B testing post-MVP
13. THE Lambda function SHALL log prompt version used alongside request metadata in CloudWatch Logs to correlate with Feedback UI responses (Requirement 12)
   - Note: Japanese and English prompts with MHLW guideline references may result in long prompts (high token consumption). Prompt versioning enables measuring effectiveness by correlating prompt version with user feedback data

### Requirement 4: Provide Childcare Attendance Guidance

**User Story:** As a working parent, I want clear guidance on whether to send my child to daycare, so that I can make informed attendance decisions quickly.

#### Acceptance Criteria

1. WHEN risk level is high, THE Recommendation_Generator SHALL include guidance about monitoring child health before attendance
2. WHEN risk level is high, THE Recommendation_Generator SHALL include specific symptoms to watch for
3. WHEN risk level is medium, THE Recommendation_Generator SHALL include preventive measures for attendance
4. WHEN risk level is low, THE Recommendation_Generator SHALL indicate normal attendance is appropriate
5. WHEN risk level is high, THE Recommendation_Generator SHALL include guidance considering common Japanese daycare attendance standards (such as 37.5°C temperature threshold)
6. WHERE user language is Japanese, THE Recommendation_Generator MAY include guidance that caution is needed even below 37.5°C if the child appears different from usual
7. WHEN risk level is high, THE Recommendation_Generator SHALL include guidance on diarrhea and vomiting frequency standards based on MHLW childcare facility guidelines
8. WHERE user language is Japanese, THE Nova_Service system prompt SHALL reference MHLW guidelines for diarrhea/vomiting observation periods (e.g., "X hours after symptoms stop") in addition to fever standards

### Requirement 5: Maintain Privacy Standards

**User Story:** As a privacy-conscious parent, I want my child's information to stay on my device, so that their personal data is not transmitted to servers.

#### Acceptance Criteria

1. THE System SHALL store child profile data only in Local_Storage
2. THE Mobile App SHALL anonymize data before sending to Backend API (age range only, prefecture/state only)
3. THE Backend API SHALL validate that received data contains no PII before calling Nova_Service (acts as trust boundary)
4. THE Backend API SHALL filter outbreak data before passing to Nova_Service (exclude data irrelevant to target region or low-priority data to optimize token cost and context window)
5. THE Risk_Analyzer SHALL use ward-level location information in Japan and county-level location information in the US to perform risk calculation
6. WHEN calling Backend API, THE Mobile App SHALL pass only age range (0-1 years, 2-3 years, 4-6 years, 7+ years) and geographic area (prefecture/state level)
   - Note: Mobile app may perform risk calculation using ward/county-level data locally, but SHALL convert to prefecture/state level before sending to Backend API
7. THE Mobile App SHALL NOT pass personally identifiable information (name, address, date of birth, exact age) to Backend API
8. THE Backend API SHALL NOT pass location information more detailed than prefecture/state level to Nova_Service
9. THE Backend API SHALL validate location field against predefined list of valid prefecture/state names (enum-style validation) to prevent granular location data from reaching Nova_Service
10. THE System SHALL NOT persist conversation history with Nova_Service
11. THE Backend API acts as the trust boundary - it SHALL reject requests containing PII or overly granular location data
12. WHEN a prefecture/state has fewer than 10 outbreak cases, THE Backend API SHALL use national-level data to prevent statistical re-identification (k-anonymity protection)
13. THE Backend API SHALL enforce k-anonymity protection logic server-side to prevent frontend code tampering

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
8. THE System SHALL display risk level indicator (high, medium, low) within 1 second using local calculation before AI recommendations load
9. WHEN AI recommendations are generating, THE System SHALL display optimistic UI with "AI generating recommendations..." animation
10. WHEN cached AI recommendations are available, THE System SHALL display them within 3 seconds
11. THE System SHALL display data source freshness indicator showing last updated date
12. WHEN outbreak data is older than 7 days, THE System SHALL display warning message indicating data may be outdated
13. WHEN outbreak data fetch fails and system uses stale cached data, THE System SHALL display specific message indicating data retrieval delay and age of data being used (e.g., "Latest data retrieval delayed. Showing 1-day-old data")

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
7. THE System SHALL display risk level indicator within 1 second using local calculation before AI recommendations load
8. THE System SHALL implement progressive disclosure: (1) Display risk level indicator within 1 second using local calculation, (2) Display cached AI recommendations within 3 seconds if available, (3) Display "AI generating recommendations..." animation if generation in progress, (4) Replace animation with AI recommendations when ready (within 5 seconds) or fallback if timeout

### Requirement 12: Collect User Feedback

**User Story:** As a product developer, I want to collect user feedback on recommendation usefulness, so that I can measure user satisfaction and identify areas for improvement.

#### Acceptance Criteria

1. THE System SHALL provide a simple feedback UI asking "Was this information helpful?" after displaying recommendations
2. THE Feedback_UI SHALL allow users to respond with "Yes" or "No" options
3. THE System SHALL save feedback data to Local_Storage
4. WHERE user consent is obtained, THE System MAY send anonymized feedback data to server
5. THE System SHALL use opt-in approach for feedback transmission
6. THE System SHALL NOT include personally identifiable information in feedback data

**Note:** Feedback analysis and Nova AI system prompt improvement workflow is outside MVP scope. This requirement focuses on data collection infrastructure only. Post-MVP enhancement should include granular feedback options when user selects "No" (e.g., "Information outdated", "Advice too general", "Text unnatural"). This enables correlation with prompt versions (Requirement 3.13) to identify which prompt iterations perform better. MVP focuses on binary feedback infrastructure only.

### Requirement 13: Backend API for Nova Integration

**User Story:** As a mobile app developer, I want a secure backend API to call Amazon Bedrock Nova, so that API credentials are not exposed in the mobile app.

#### Acceptance Criteria

1. THE Backend API SHALL provide a POST endpoint `/recommendations/generate` that accepts outbreak data, age range, prefecture/state, language, and optional nearby_hotspot boolean flag
2. THE Backend API SHALL call Amazon Bedrock Nova Lite or Nova Micro based on risk level
3. THE Backend API SHALL return structured JSON response with summary and action items
4. THE Lambda function SHALL have timeout of 10-15 seconds to accommodate Bedrock Guardrails pre/post-inference filtering and cold starts
5. THE Backend API SHALL implement strict 5-second timeout for Nova API calls only and return fallback recommendations immediately on timeout or failure
   - Note: Lambda timeout (10-15s) provides margin for cold starts and Guardrails latency, while Bedrock call timeout (5s) ensures fast user experience. Mobile app should set timeout of 6+ seconds and use optimistic UI to display "AI generating" placeholder
   - Timeout sequence: Mobile sends request → Lambda receives (starts 10-15s timer) → Bedrock call (5s timeout) → If timeout/error, immediate fallback → Lambda returns → Mobile receives (within 6s). Risk_Analyzer 3s target (Requirement 1.1) is for cached data path
6. THE Backend API SHALL validate input parameters before calling Nova API (acts as trust boundary)
7. THE Backend API SHALL reject requests containing PII or location data more granular than prefecture/state level
8. THE Backend API SHALL sanitize and validate Nova API responses before returning to client
9. WHEN Nova API response fails JSON schema validation or contains incomplete fields, THE Backend API SHALL return fallback recommendations immediately
10. THE Backend API SHALL log all API calls with anonymized parameters for monitoring
11. THE Backend API SHALL implement rate limiting (10 requests per 15 minutes per Cognito Identity ID) - see Requirement 15.7 for additional details
   - Note: Unauthenticated users can obtain new Identity ID by reinstalling app. For MVP, implement API Gateway Usage Plans to enforce rate limits per API key (Cognito Identity ID) at no additional cost. Usage Plans can enforce burst limits (requests per second) and quota limits (requests per day/month). Post-MVP, consider adding WAF for IP-based rate limiting if abuse patterns emerge.
12. THE Backend API SHALL return appropriate HTTP status codes (200, 400, 429, 500, 503)
13. WHEN nearby_hotspot flag is true, THE Nova_Service system prompt SHALL emphasize heightened vigilance while maintaining prefecture/state-level anonymity
14. THE Backend API SHALL accept nearby_hotspot as optional boolean parameter (defaults to false if not provided)
15. THE Backend API MAY implement dynamic prompt construction by extracting disease-specific guideline excerpts before calling Nova API to optimize token usage (post-MVP enhancement)

### Requirement 14: Infrastructure Deployment with Terraform

**User Story:** As a DevOps engineer, I want to deploy infrastructure using Terraform, so that resources are reproducible and version-controlled.

#### Acceptance Criteria

1. THE Infrastructure SHALL be defined using Terraform in `infra/` directory
2. THE Infrastructure SHALL support multiple environments (dev, stag, prod) in `infra/environments/` directory
3. THE Infrastructure SHALL use reusable modules in `infra/modules/aws/` directory
4. THE Infrastructure SHALL create Lambda function for Nova API integration
5. THE Infrastructure SHALL create API Gateway REST API with `/recommendations/generate` endpoint
6. THE Infrastructure SHALL create DynamoDB table for caching recommendations with 24-hour TTL
7. THE Infrastructure SHALL create IAM role for Lambda with minimum required permissions (Bedrock and DynamoDB access only)
8. THE Infrastructure SHALL create Cognito Identity Pool for unauthenticated mobile app access
9. THE Infrastructure SHALL enable Amazon Bedrock Nova Lite and Nova Micro model access in `us-east-1` region
10. THE Infrastructure SHALL configure CloudWatch Logs for Lambda function monitoring with 7-day log retention
11. THE Infrastructure SHALL output API Gateway endpoint URL and Cognito Identity Pool ID after deployment
12. THE Infrastructure SHALL use standard environment naming (dev, stag, prod)
13. THE Infrastructure SHALL tag all resources with Environment tag
14. THE Infrastructure SHALL create API Gateway Usage Plan with burst limit of 10 requests per second and quota limit of 1000 requests per day per Cognito Identity ID
15. WHERE Japan location is selected, THE Infrastructure SHALL store e-Stat API application ID in AWS Secrets Manager or Systems Manager Parameter Store for secure access
   - Note: e-Stat API requires application ID (appId) registration at https://www.e-stat.go.jp/api/. Lambda function should retrieve this credential at runtime

**Note:** Default deployment target is dev environment for initial development. Staging and production deployment procedures (including approval workflows, rollback procedures, and monitoring setup) are outside MVP scope and should be documented in separate operational runbooks.

### Requirement 15: Security and Access Control

**User Story:** As a security engineer, I want to ensure secure API access, so that the system protects user data and prevents abuse.

#### Acceptance Criteria

1. THE Lambda function SHALL use IAM role with least-privilege permissions
2. THE Lambda function SHALL have permission to invoke Bedrock Nova Lite and Nova Micro models
3. THE Lambda function SHALL have permission to read/write DynamoDB cache table
4. THE Lambda function SHALL NOT have permission to access S3 or other AWS services beyond DynamoDB and Bedrock
5. THE API Gateway SHALL use IAM authentication (AWS Signature Version 4) for mobile app requests
6. THE Mobile App SHALL use AWS Cognito Identity Pool for temporary AWS credentials (unauthenticated access)
7. THE API Gateway SHALL use Usage Plans to enforce per-identity rate limits without additional WAF costs for MVP
8. THE API Gateway SHALL implement rate limiting (10 requests per 15 minutes per Cognito Identity ID) as defined in Requirement 13.10
   - Note: Unauthenticated users can obtain new Identity ID by reinstalling app. For MVP, implement API Gateway Usage Plans to enforce rate limits per API key (Cognito Identity ID) at no additional cost. Usage Plans can enforce burst limits (requests per second) and quota limits (requests per day/month). Post-MVP, consider adding WAF for IP-based rate limiting if abuse patterns emerge.
9. THE Infrastructure SHALL create CloudWatch dashboard for cost monitoring (displaying Nova API call count, cache hit rate, rate limit exceeded count, Lambda execution time, estimated monthly cost)
10. THE API Gateway SHALL enable CloudWatch logging for all requests
11. THE API Gateway SHALL use HTTPS only (no HTTP)
12. THE Lambda function SHALL validate all input parameters to prevent injection attacks
13. THE Lambda function SHALL sanitize Nova API responses to remove any unexpected content
14. THE System SHALL NOT log personally identifiable information (PII)
15. THE Infrastructure MAY implement AWS WAF rules to block suspicious User-Agent patterns (future enhancement)

### Requirement 16: Cost Optimization

**User Story:** As a product owner, I want to minimize AI API costs, so that the feature is financially sustainable.

#### Acceptance Criteria

1. THE Backend API SHALL use Nova Micro for low-risk scenarios to reduce costs
2. THE Backend API SHALL use Nova Micro for medium-risk scenarios (sufficient quality for single-disease outbreaks)
3. THE Backend API SHALL use Nova Lite for high-risk scenarios with multiple concurrent high-severity diseases (severity ≥7)
4. THE Backend API SHALL use Nova Micro for high-risk scenarios with single disease outbreak (cost-efficient for simpler cases)
5. THE Infrastructure MAY place CloudFront in front of API Gateway OR enable API Gateway caching to serve identical requests without Lambda invocation
   - Note: Outbreak data depends on region (prefecture/state) and child age group, not user-specific information. Global cache at CloudFront or API Gateway level can significantly reduce Lambda invocations and costs for identical conditions
6. THE Backend API SHALL implement DynamoDB caching with key format: `{prefecture/state}_{ageRange}_{outbreakDataHash}`
   - Note: Backend generates cache key from normalized outbreak data. Normalization: (1) sort disease names alphabetically, (2) round severity scores to 1 decimal, (3) use YYYY-MM-DD date format. Mobile app does not participate in cache key generation
7. THE Backend API SHALL cache recommendations in DynamoDB for 24 hours using TTL attribute
8. THE Backend API SHALL check DynamoDB cache before calling Nova API to minimize costs
9. THE Backend API SHALL track Nova API usage metrics (Lite calls, Micro calls, fallback usage, cache hits)
10. THE Lambda function SHALL use appropriate memory allocation (512MB-1024MB) to balance cost and performance
11. THE DynamoDB table SHALL use on-demand billing mode to minimize costs when usage is low
12. THE System SHALL achieve the following cost targets:
   - Nova-related costs (Bedrock API calls): Under $20 USD per month
   - Other running costs (Lambda, DynamoDB, API Gateway, CloudWatch Logs, etc.): Under $2 USD per month

**Note:** Cost target assumptions: 100 daily requests, 80% cache hit rate, primarily Nova Micro usage. Actual costs depend on usage patterns and should be monitored via CloudWatch metrics.

### Requirement 17: Monitoring and Observability

**User Story:** As a DevOps engineer, I want to monitor system health, so that I can detect and resolve issues quickly.

#### Acceptance Criteria

1. THE Lambda function SHALL log all invocations to CloudWatch Logs
2. THE Lambda function SHALL log Nova API latency metrics
3. THE Lambda function SHALL log Nova API error rates
4. THE Lambda function SHALL log fallback usage frequency
5. THE System SHALL create CloudWatch alarms for Lambda errors (threshold: 5% error rate)
6. THE System SHALL create CloudWatch alarms for Lambda duration (threshold: 4 seconds)
7. THE API Gateway SHALL log all requests with response status codes

### Requirement 18: Frontend Integration with AWS Amplify

**User Story:** As a mobile app developer, I want to integrate AWS services using Amplify, so that authentication and API calls are simplified.

#### Acceptance Criteria

1. THE Mobile App SHALL use AWS Amplify JS library for AWS service integration
2. THE Mobile App SHALL configure Amplify with Cognito Identity Pool ID and API Gateway endpoint URL
3. THE Mobile App SHALL use Amplify Auth to obtain temporary AWS credentials from Cognito Identity Pool
4. THE Mobile App SHALL use Amplify API to call API Gateway with automatic IAM signature (AWS Signature Version 4)
5. THE Amplify configuration SHALL be stored in `mobile/src/aws-exports.ts` or similar configuration file
6. THE Mobile App SHALL handle Amplify initialization errors gracefully
7. THE Mobile App SHALL NOT hardcode AWS credentials or API keys in source code

#### Custom Domain Configuration

1. THE Amplify hosting SHALL support custom domain configuration via Terraform
2. THE custom domain SHALL be `outbreak-radar-for-kids.kumagaias.com`
3. THE Amplify domain association SHALL automatically provision SSL certificate via AWS Certificate Manager
4. THE DNS configuration SHALL include CNAME record pointing to Amplify domain
5. THE custom domain SHALL enforce HTTPS (HTTP requests redirect to HTTPS)
6. THE custom domain SHALL be accessible within 60 minutes of DNS configuration
7. THE mobile app SHALL function correctly when accessed via custom domain

### Requirement 19: Fetch Real Outbreak Data from Public APIs

**User Story:** As a user, I want the app to use real outbreak data from multiple CDC surveillance systems, so that I receive accurate and up-to-date risk assessments based on comprehensive disease surveillance data.

#### Acceptance Criteria

**Data Sources:**

1. THE Outbreak_Data_Fetcher SHALL fetch wastewater surveillance data from CDC NWSS Public SARS-CoV-2 Wastewater Metric Data API (https://data.cdc.gov/api/views/2ew6-ywp6) for US locations
   - Note: Use metric data (2ew6-ywp6) instead of raw sample data (j9g8-acpt) for risk scoring. Metric data provides processed indicators suitable for severity calculation
2. THE Outbreak_Data_Fetcher MAY fetch wastewater surveillance data from WastewaterSCAN API (data.wastewaterscan.org) for additional US coverage
   - Note: WastewaterSCAN API is not officially documented and endpoint specifications may change. Implementation should include error handling for API changes. This is an optional enhancement; NWSS provides sufficient wastewater coverage for MVP
3. THE Outbreak_Data_Fetcher SHALL fetch hospital admission data from CDC NHSN API via data.cdc.gov for US state-level hospital burden
4. THE Outbreak_Data_Fetcher SHALL fetch ILI surveillance data from Delphi Epidata FluView API (https://api.delphi.cmu.edu/epidata/fluview/) for early signal detection
5. THE Outbreak_Data_Fetcher SHALL fetch hospitalization rate data from Delphi Epidata FluSurv-NET API (https://api.delphi.cmu.edu/epidata/flusurv/) for age-specific risk assessment

**API Access:**

6. THE Outbreak_Data_Fetcher SHALL use SODA_API (Socrata Open Data API) to access CDC NWSS and NHSN data in JSON format
7. THE Outbreak_Data_Fetcher MAY use optional API key for CDC NHSN to improve request priority (API key is free but not required)
8. THE Outbreak_Data_Fetcher SHALL access Delphi Epidata APIs without authentication (no API key required)

**Data Processing:**

9. THE Outbreak_Data_Fetcher SHALL update outbreak data weekly, aligned with CDC's Friday update schedule
10. WHEN API calls fail, THE Outbreak_Data_Fetcher SHALL use cached data as fallback
11. WHEN cached data is unavailable and API calls fail, THE System SHALL display an error message to the user
12. THE Outbreak_Data_Fetcher SHALL normalize data from multiple sources into a unified OutbreakData format
13. THE Outbreak_Data_Fetcher SHALL filter data by geographic area (state and county level for US)
14. THE Outbreak_Data_Fetcher SHALL calculate severity scores using the following weighted formula:
    - WHEN all 4 data sources are available: Wastewater viral activity levels (from NWSS and WastewaterSCAN): 40% weight, ILI percentage trends (from FluView): 30% weight, Hospital admission counts (from NHSN): 20% weight, Hospitalization rates per 100k population (from FluSurv-NET): 10% weight
    - WHEN WastewaterSCAN data is unavailable: Redistribute weights proportionally among remaining sources (NWSS wastewater: 40%, FluView ILI: 35%, NHSN hospital admissions: 15%, FluSurv-NET hospitalization rates: 10%)
    - WHEN any other single source is unavailable: Redistribute that source's weight proportionally among remaining sources
   - Note: Weights reflect temporal characteristics - wastewater is a leading indicator (1-2 weeks ahead), while hospitalizations are lagging indicators. Normalize each metric to 0-100 scale using Min-Max Scaling based on trailing 12-month maximum and minimum values per disease before applying weights. This ensures disease-specific severity differences are accurately reflected in scores. For cold start scenarios (new deployment or new disease), use CDC baseline values as fallback: wastewater activity level 5 (moderate), ILI percentage 2.5%, hospital admissions 1000 per week, hospitalization rate 5 per 100k population. WastewaterSCAN is optional (Req 19.2). When unavailable, weights are redistributed as specified.
15. THE Background_Batch_Processor SHALL transform raw data into normalized intermediate format before storing in DynamoDB to isolate downstream systems from source format changes
16. THE System SHALL store last_updated timestamp for each data source as metadata in DynamoDB

**Disease Coverage:**

17. THE Outbreak_Data_Fetcher SHALL support the following diseases from CDC NWSS: SARS-CoV-2, Influenza A, RSV, Measles, Mpox, H5
18. THE Outbreak_Data_Fetcher SHALL support the following diseases from WastewaterSCAN: COVID-19, Influenza, RSV, Norovirus
19. THE Outbreak_Data_Fetcher SHALL support the following diseases from NHSN: Influenza, COVID-19, RSV
20. THE Outbreak_Data_Fetcher SHALL support the following diseases from FluView: Influenza-like illness (ILI)
21. THE Outbreak_Data_Fetcher SHALL support the following diseases from FluSurv-NET: Influenza A, Influenza B

**Age-Specific Data:**

22. THE Outbreak_Data_Fetcher SHALL prioritize FluSurv-NET data for children under 18 years due to granular age groups (0-1, 1-4, 5-11, 12-17 years)
23. THE Outbreak_Data_Fetcher SHALL use FluView age group 0-4 years as fallback when FluSurv-NET data is unavailable
24. THE System SHALL map app age ranges to FluSurv-NET age groups as follows:
    - App age range 0-1 years → FluSurv-NET 0-1 years
    - App age range 2-3 years → FluSurv-NET 1-4 years
    - App age range 4-6 years → FluSurv-NET 5-11 years (use higher age group for conservative risk assessment)
    - App age range 7+ years → FluSurv-NET 5-11 years or 12-17 years (select based on specific age if available, otherwise use 5-11 years)

**Geographic Coverage:**

25. WHERE US location is selected, THE Outbreak_Data_Fetcher SHALL combine data from all available sources for comprehensive coverage
26. WHERE Japan location is selected, THE System SHALL use IDWR (Infectious Disease Weekly Report) CSV data from NIID (National Institute of Infectious Diseases) at https://id-info.jihs.go.jp/surveillance/idwr/ as primary data source
27. WHERE Japan location is selected, THE System SHALL use e-Stat API (https://www.e-stat.go.jp/) to fetch "Infectious Disease Surveillance" data for norovirus (reported as "infectious gastroenteritis") with weekly update frequency
   - Note: e-Stat provides government statistics including infectious disease data. Norovirus is reported as "infectious gastroenteritis" category, not as separate disease
28. WHERE Japan location is selected and prefecture is Tokyo, THE System MAY use prefecture-specific data from Tokyo Metropolitan Infectious Disease Surveillance Center (https://idsc.tmiph.metro.tokyo.lg.jp/) for enhanced granularity
   - Note: WHEN Tokyo-specific data is unavailable, THE System SHALL use IDWR national-level data as specified in Req 19.29
29. WHERE Japan location is selected and prefecture is not Tokyo, THE System SHALL use IDWR national-level data as fallback
   - Note: When using IDWR national-level data, geographic proximity accuracy (Requirement 1.3) is reduced as data includes all prefectures. This is an acceptable tradeoff for MVP to ensure data availability. Risk calculation should weight national trends appropriately, with user notification that prefecture-specific data is unavailable. Acceptable precision loss: National data may include outbreaks 1000+ km away. This is acceptable for MVP as it ensures data availability. User should be notified: 'Prefecture-specific data unavailable. Showing national trends.'
30. WHERE Japan location is selected and no public data is available, THE System SHALL use pre-seeded mock data derived from historical IDWR CSV data as fallback
   - Note: Mock data should be based on actual historical patterns from IDWR to provide realistic risk assessments for demo and development purposes
31. THE System SHALL use background batch processing (Lambda + EventBridge) to periodically fetch and normalize data from e-Stat API and NIID CSV sources, storing results in DynamoDB
   - Note: Japanese data sources (e-Stat, NIID CSV) have unstable response times and parsing delays. Background batch processing ensures 3-second risk calculation target (Requirement 1.1) is achievable by pre-fetching and normalizing data
32. THE Background_Batch_Processor SHALL run on a schedule aligned with data source update frequencies (weekly for IDWR, weekly for e-Stat)
33. THE Outbreak_Data_Fetcher MAY implement CSV parsing or web scraping for Japan data sources that do not provide API access
   - Note: Prioritize CSV parsing over web scraping. Web scraping should be used only as a last resort due to terms of service violation risks and HTML structure change fragility

**Caching and Performance:**

31. THE Outbreak_Data_Fetcher SHALL cache fetched data in DynamoDB with 10-day TTL to support stale-while-revalidate pattern
32. THE Outbreak_Data_Fetcher SHALL consider cached data stale when older than 7 days (aligned with CDC's weekly update schedule)
33. THE Outbreak_Data_Fetcher SHALL log API call success/failure rates for monitoring
34. THE Outbreak_Data_Fetcher SHALL handle rate limiting from external APIs gracefully with exponential backoff
35. THE Outbreak_Data_Fetcher SHALL fetch data from multiple APIs in parallel to minimize latency
36. THE Outbreak_Data_Fetcher SHALL complete data fetching within 10 seconds or use cached data
37. WHEN cached data exists but is stale (older than 7 days but within 10-day TTL), THE Outbreak_Data_Fetcher SHALL attempt to refresh data in background while serving cached data to user
   - Note: This implements stale-while-revalidate pattern. DynamoDB TTL (10 days) is longer than freshness threshold (7 days) to allow serving stale data during background refresh
