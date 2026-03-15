/**
 * Outbreak Data Service
 * Fetches real outbreak data from DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

class OutbreakDataService {
  constructor(tableName, region = 'us-east-1') {
    this.tableName = tableName || process.env.DYNAMODB_OUTBREAK_TABLE_NAME;
    
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  /**
   * Get outbreak data for a specific geographic area
   * @param {string} geographicArea - State/prefecture name
   * @param {string} country - Country code (JP or US)
   * @returns {Promise<Array>} Array of outbreak data
   */
  async getOutbreakDataForArea(geographicArea, country) {
    try {
      const params = {
        TableName: this.tableName,
        KeyConditionExpression: 'geographicArea = :area',
        ExpressionAttributeValues: {
          ':area': geographicArea
        },
        Limit: 50 // Limit to prevent large responses
      };

      const result = await this.docClient.send(new QueryCommand(params));
      
      // Transform DynamoDB format to mobile app format
      return (result.Items || []).map(item => this.transformToMobileFormat(item, country));
    } catch (error) {
      console.error('Error fetching outbreak data:', error);
      throw error;
    }
  }

  /**
   * Get nationwide outbreak data for a country
   * @param {string} country - Country code (JP or US)
   * @returns {Promise<Array>} Array of outbreak data for all areas
   */
  async getNationwideOutbreakData(country) {
    try {
      const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
      
      const params = {
        TableName: this.tableName,
        FilterExpression: 'country = :country',
        ExpressionAttributeValues: {
          ':country': country
        }
      };

      const result = await this.docClient.send(new ScanCommand(params));
      
      console.log(`Scanned ${result.Items?.length || 0} items for country ${country}`);
      
      // Transform DynamoDB format to mobile app format
      return (result.Items || []).map(item => this.transformToMobileFormat(item, country));
    } catch (error) {
      console.error('Error fetching nationwide outbreak data:', error);
      throw error;
    }
  }

  /**
   * Transform DynamoDB item to mobile app format
   */
  transformToMobileFormat(item, country) {
    const diseaseMap = {
      'Influenza': 'influenza',
      'RSV': 'rsv',
      'Norovirus': 'norovirus',
      'COVID-19': 'covid-19',
      'Hand, Foot & Mouth Disease': 'hand-foot-mouth'
    };

    const diseaseId = diseaseMap[item.disease] || item.disease.toLowerCase();
    
    // Calculate risk level from severity score (0-10)
    let level = 'low';
    if (item.severity >= 7) level = 'high';
    else if (item.severity >= 4) level = 'medium';

    // Calculate weekly change from trend
    const weeklyChange = item.dataSource?.trend === 'increasing' ? 15 :
                        item.dataSource?.trend === 'decreasing' ? -10 : 0;

    return {
      area: item.geographicArea,
      country,
      diseaseId,
      diseaseName: item.disease,
      diseaseNameLocal: this.getLocalDiseaseName(item.disease, country),
      level,
      cases: Math.round(item.metrics?.reportedCases || 0),
      weeklyChange,
      lastUpdated: new Date(item.timestamp),
      sewerageVirusLevel: item.metrics?.wastewater_concentration || undefined,
      hospitalizations: item.metrics?.hospitalizations || undefined,
      schoolClosures: item.metrics?.school_closures || undefined,
      peakWeek: item.metrics?.peak_week || undefined
    };
  }

  /**
   * Get localized disease name
   */
  getLocalDiseaseName(disease, country) {
    if (country !== 'JP') return disease;

    const nameMap = {
      'Influenza': 'インフルエンザ',
      'RSV': 'RSウイルス',
      'Norovirus': 'ノロウイルス',
      'COVID-19': 'COVID-19',
      'Hand, Foot & Mouth Disease': '手足口病'
    };

    return nameMap[disease] || disease;
  }
}

module.exports = OutbreakDataService;
