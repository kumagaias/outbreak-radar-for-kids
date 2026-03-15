/**
 * DynamoDB Storage Module
 * 
 * Stores normalized outbreak data in DynamoDB with 10-day TTL
 * Partitioned by geographic area (state/prefecture) and disease
 * 
 * Requirements: 19.15, 19.16, 19.31
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Table name from environment variable
const TABLE_NAME = process.env.DYNAMODB_OUTBREAK_TABLE_NAME || 'outbreak-data-dev';

// TTL duration: 10 days in seconds
const TTL_DURATION_SECONDS = 10 * 24 * 60 * 60; // 864000 seconds

/**
 * Store a single outbreak data record in DynamoDB
 * @param {Object} outbreakData - Normalized outbreak data
 * @param {string} outbreakData.geographicArea - State/prefecture name
 * @param {string} outbreakData.disease - Disease name
 * @param {number} outbreakData.severity - Severity score (0-10)
 * @param {Object} outbreakData.metrics - Raw metrics
 * @param {Object} outbreakData.normalizedMetrics - Normalized metrics (0-100)
 * @param {string} outbreakData.timestamp - ISO timestamp
 * @param {Object} outbreakData.dataSource - Data source flags
 * @param {string} outbreakData.coverageLevel - Coverage level (exact/national)
 * @param {number} outbreakData.proximityAdjustment - Proximity adjustment factor
 * @returns {Promise<Object>} DynamoDB put result
 */
async function storeOutbreakData(outbreakData) {
  if (!outbreakData || !outbreakData.geographicArea || !outbreakData.disease) {
    throw new Error('Invalid outbreak data: geographicArea and disease are required');
  }

  // Calculate expiration time (current time + 10 days)
  const expirationTime = Math.floor(Date.now() / 1000) + TTL_DURATION_SECONDS;

  // Create DynamoDB item (using camelCase for consistency with backend queries)
  const item = {
    geographicArea: outbreakData.geographicArea,
    diseaseId: outbreakData.diseaseId || outbreakData.disease, // Use provided diseaseId or fall back to disease
    disease: outbreakData.disease,
    country: outbreakData.country || 'US', // Add country field
    severity: outbreakData.severity,
    metrics: outbreakData.metrics,
    normalizedMetrics: outbreakData.normalizedMetrics,
    timestamp: outbreakData.timestamp,
    dataSource: outbreakData.dataSource,
    coverageLevel: outbreakData.coverageLevel || 'exact',
    proximityAdjustment: outbreakData.proximityAdjustment || 1.0,
    expirationTime: expirationTime
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  });

  try {
    const result = await docClient.send(command);
    console.log('Stored outbreak data:', {
      geographicArea: item.geographicArea,
      disease: item.disease,
      country: item.country,
      severity: item.severity
    });
    return result;
  } catch (error) {
    console.error('Error storing outbreak data:', error);
    throw error;
  }
}

/**
 * Store multiple outbreak data records in batch
 * @param {Array<Object>} outbreakDataArray - Array of normalized outbreak data
 * @returns {Promise<Object>} Batch write result with success/failure counts
 */
async function batchStoreOutbreakData(outbreakDataArray) {
  if (!Array.isArray(outbreakDataArray) || outbreakDataArray.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const expirationTime = Math.floor(Date.now() / 1000) + TTL_DURATION_SECONDS;
  
  // DynamoDB BatchWriteItem has a limit of 25 items per request
  const BATCH_SIZE = 25;
  let successCount = 0;
  let failureCount = 0;

  // Process in batches
  for (let i = 0; i < outbreakDataArray.length; i += BATCH_SIZE) {
    const batch = outbreakDataArray.slice(i, i + BATCH_SIZE);
    
    const putRequests = batch.map((data, index) => ({
      PutRequest: {
        Item: {
          geographicArea: data.geographicArea,
          diseaseId: data.diseaseId || data.disease, // Use provided diseaseId or fall back to disease
          disease: data.disease,
          country: data.country || 'US', // Add country field
          severity: data.severity,
          metrics: data.metrics,
          normalizedMetrics: data.normalizedMetrics,
          timestamp: data.timestamp,
          dataSource: data.dataSource,
          coverageLevel: data.coverageLevel || 'exact',
          proximityAdjustment: data.proximityAdjustment || 1.0,
          expirationTime: expirationTime
        }
      }
    }));

    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: putRequests
      }
    });

    try {
      const result = await docClient.send(command);
      
      // Check for unprocessed items
      const unprocessedCount = result.UnprocessedItems?.[TABLE_NAME]?.length || 0;
      successCount += batch.length - unprocessedCount;
      failureCount += unprocessedCount;

      if (unprocessedCount > 0) {
        console.warn(`Batch write had ${unprocessedCount} unprocessed items`);
      }
    } catch (error) {
      console.error('Error in batch write:', error.message || error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      failureCount += batch.length;
    }
  }

  console.log(`Batch store complete: ${successCount} success, ${failureCount} failures`);
  return { successCount, failureCount };
}

/**
 * Retrieve outbreak data for a specific geographic area and disease
 * @param {string} geographicArea - State/prefecture name
 * @param {string} disease - Disease name
 * @returns {Promise<Array<Object>>} Array of outbreak data records
 */
async function getOutbreakData(geographicArea, disease) {
  if (!geographicArea || !disease) {
    throw new Error('geographicArea and disease are required');
  }

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'geographicArea = :area AND begins_with(diseaseId, :disease)',
    ExpressionAttributeValues: {
      ':area': geographicArea,
      ':disease': disease
    },
    ScanIndexForward: false, // Sort by diseaseId descending (most recent first)
    Limit: 10 // Get latest 10 records
  });

  try {
    const result = await docClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error retrieving outbreak data:', error);
    throw error;
  }
}

/**
 * Get all outbreak data for a geographic area (all diseases)
 * @param {string} geographicArea - State/prefecture name
 * @returns {Promise<Array<Object>>} Array of outbreak data records
 */
async function getAllOutbreakDataForArea(geographicArea) {
  if (!geographicArea) {
    throw new Error('geographicArea is required');
  }

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'geographicArea = :area',
    ExpressionAttributeValues: {
      ':area': geographicArea
    },
    ScanIndexForward: false
  });

  try {
    const result = await docClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Error retrieving all outbreak data for area:', error);
    throw error;
  }
}

module.exports = {
  storeOutbreakData,
  batchStoreOutbreakData,
  getOutbreakData,
  getAllOutbreakDataForArea,
  TTL_DURATION_SECONDS
};
