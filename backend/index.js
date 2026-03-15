/**
 * Lambda function handler for Nova AI Recommendations API
 * Endpoint: POST /recommendations/generate
 */

const DataAnonymizer = require('./lib/data-anonymizer');
const SharedCacheManager = require('./lib/shared-cache-manager');
const NovaService = require('./lib/nova-service');
const { generateFallbackRecommendation } = require('./lib/fallback-templates');

// Initialize services
const dataAnonymizer = new DataAnonymizer();
const sharedCacheManager = new SharedCacheManager(
  process.env.DYNAMODB_SHARED_CACHE_TABLE_NAME,
  process.env.AWS_REGION || 'us-east-1'
);
const novaService = new NovaService(
  process.env.GUARDRAIL_ID,
  process.env.GUARDRAIL_VERSION || 'DRAFT',
  process.env.BEDROCK_REGION || 'us-east-1'
);

/**
 * Main Lambda handler
 * @param {Object} event - API Gateway event
 * @returns {Promise<Object>} API Gateway response
 */
exports.handler = async (event) => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const startTime = Date.now();
  
  console.log('Request ID:', requestId);
  console.log('Environment:', process.env.ENVIRONMENT);
  
  try {
    // Parse request body
    let request;
    try {
      request = parseRequestBody(event);
    } catch (parseError) {
      console.error('Request parsing failed:', parseError.message);
      return createErrorResponse(400, parseError.message);
    }
    
    // Validate input parameters (trust boundary)
    const validation = dataAnonymizer.validateNoPII(request);
    if (!validation.isValid) {
      console.error('Validation failed:', validation.errors);
      return createErrorResponse(400, 'Invalid request parameters', validation.errors);
    }
    
    // Anonymize location to prefecture/state level
    const anonymizedArea = dataAnonymizer.anonymizeLocation(request.geographicArea);
    
    // Filter outbreak data to optimize token cost
    const filteredOutbreakData = dataAnonymizer.filterOutbreakData(
      request.outbreakData || [],
      anonymizedArea
    );
    
    // Generate cache key
    const cacheKey = sharedCacheManager.generateCacheKey(
      anonymizedArea,
      request.ageRange,
      filteredOutbreakData
    );
    
    console.log('Cache key:', cacheKey);
    
    // Check server-side cache
    const cached = await sharedCacheManager.getCachedRecommendation(cacheKey);
    if (cached) {
      console.log('Server-side cache hit');
      logMetrics(requestId, 'cache_hit', Date.now() - startTime);
      
      return createSuccessResponse({
        recommendation: cached,
        source: 'server_cache',
        cacheHit: true
      });
    }
    
    console.log('Server-side cache miss, calling Nova');
    
    // Prepare request for Nova
    const novaRequest = {
      ageRange: request.ageRange,
      geographicArea: anonymizedArea,
      riskLevel: request.riskLevel,
      language: request.language,
      diseaseNames: request.diseaseNames || [],
      outbreakData: filteredOutbreakData,
      nearbyHotspot: request.nearbyHotspot || false // Default to false if not provided
    };
    
    // Generate recommendation via Nova
    let recommendation;
    try {
      recommendation = await novaService.generateRecommendation(novaRequest);
      console.log('Nova generation successful, source:', recommendation.source);
    } catch (error) {
      console.error('Nova generation failed, using fallback:', error);
      
      // Extract disease names from outbreak data for fallback
      const diseaseNamesForFallback = filteredOutbreakData.length > 0
        ? filteredOutbreakData.map(d => d.diseaseName).filter(Boolean)
        : (request.diseaseNames || []);
      
      recommendation = generateFallbackRecommendation(
        request.riskLevel,
        request.language,
        diseaseNamesForFallback,
        anonymizedArea
      );
    }
    
    // Save to cache (fire and forget - don't block response)
    sharedCacheManager.setCachedRecommendation(cacheKey, recommendation)
      .catch(err => console.error('Cache write failed:', err));
    
    // Log metrics
    logMetrics(requestId, recommendation.source, Date.now() - startTime);
    
    return createSuccessResponse({
      recommendation,
      cacheHit: false
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    
    // Sanitize error for logging
    const sanitizedError = dataAnonymizer.sanitizeForLogging({
      message: error.message,
      stack: error.stack
    });
    console.error('Sanitized error:', sanitizedError);
    
    // Determine appropriate status code
    if (error.message?.includes('timeout')) {
      return createErrorResponse(503, 'Service temporarily unavailable');
    }
    
    return createErrorResponse(500, 'Internal server error');
  }
};

/**
 * Parses request body from API Gateway event
 * @param {Object} event - API Gateway event
 * @returns {Object} Parsed request
 */
function parseRequestBody(event) {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    if (!body) {
      throw new Error('Request body is required');
    }
    
    return body;
  } catch (error) {
    throw new Error(`Invalid request body: ${error.message}`);
  }
}

/**
 * Creates success response
 * @param {Object} data - Response data
 * @returns {Object} API Gateway response
 */
function createSuccessResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

/**
 * Creates error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Array} errors - Optional error details
 * @returns {Object} API Gateway response
 */
function createErrorResponse(statusCode, message, errors = null) {
  const body = {
    error: message,
    timestamp: new Date().toISOString()
  };
  
  if (errors) {
    body.details = errors;
  }
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

/**
 * Logs metrics to CloudWatch
 * @param {string} requestId - Request ID
 * @param {string} source - Recommendation source
 * @param {number} durationMs - Duration in milliseconds
 */
function logMetrics(requestId, source, durationMs) {
  console.log(JSON.stringify({
    metric: 'recommendation_generated',
    requestId,
    source,
    durationMs,
    timestamp: new Date().toISOString()
  }));
}
