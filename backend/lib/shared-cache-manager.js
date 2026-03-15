/**
 * SharedCacheManager - Manages server-side shared recommendation cache
 * Implements cost optimization by caching AI responses for 1 hour
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

class SharedCacheManager {
  constructor(tableName, region = 'us-east-1') {
    this.tableName = tableName;
    
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client);
    
    this.CACHE_TTL_SECONDS = 3600; // 1 hour
  }

  /**
   * Generates cache key with normalization
   * Format: {prefecture/state}_{ageRange}_{outbreakDataHash}
   * @param {string} geographicArea - Geographic area (prefecture/state, country)
   * @param {string} ageRange - Age range (0-1, 2-3, 4-6, 7+)
   * @param {Array} outbreakData - Outbreak data array
   * @returns {string} Cache key
   */
  generateCacheKey(geographicArea, ageRange, outbreakData) {
    // Extract prefecture/state (first part before comma)
    const prefecture = geographicArea.split(',')[0].trim();
    
    // Normalize outbreak data: sort disease names, exclude timestamps
    const normalizedDiseases = outbreakData
      .map(o => o.diseaseName)
      .filter(name => name) // Remove undefined/null
      .sort()
      .join(',');
    
    // Calculate hash (first 16 characters of SHA-256)
    const hash = crypto
      .createHash('sha256')
      .update(normalizedDiseases)
      .digest('hex')
      .substring(0, 16);
    
    return `${prefecture}_${ageRange}_${hash}`;
  }

  /**
   * Gets cached recommendation from DynamoDB
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached recommendation or null if not found
   */
  async getCachedRecommendation(cacheKey) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { cache_key: cacheKey }
      });
      
      const result = await this.docClient.send(command);
      
      if (!result.Item) {
        return null;
      }
      
      // Check if item has expired (DynamoDB TTL is eventually consistent)
      const now = Math.floor(Date.now() / 1000);
      if (result.Item.expiration_time && result.Item.expiration_time < now) {
        return null;
      }
      
      return JSON.parse(result.Item.recommendation);
    } catch (error) {
      console.error('Error getting cached recommendation:', error);
      return null;
    }
  }

  /**
   * Sets cached recommendation in DynamoDB with 1-hour TTL
   * @param {string} cacheKey - Cache key
   * @param {Object} recommendation - Recommendation object to cache
   * @returns {Promise<void>}
   */
  async setCachedRecommendation(cacheKey, recommendation) {
    try {
      const expirationTime = Math.floor(Date.now() / 1000) + this.CACHE_TTL_SECONDS;
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          cache_key: cacheKey,
          recommendation: JSON.stringify(recommendation),
          expiration_time: expirationTime,
          created_at: Date.now()
        }
      });
      
      await this.docClient.send(command);
    } catch (error) {
      console.error('Error setting cached recommendation:', error);
      // Don't throw - cache write failure shouldn't break the request
    }
  }

  /**
   * Invalidates cache entry (for testing/debugging)
   * @param {string} cacheKey - Cache key to invalidate
   * @returns {Promise<void>}
   */
  async invalidateCache(cacheKey) {
    try {
      const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { cache_key: cacheKey }
      });
      
      await this.docClient.send(command);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }
}

module.exports = SharedCacheManager;
