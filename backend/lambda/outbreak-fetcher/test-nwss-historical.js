/**
 * Test NWSS with historical data
 */

const https = require('https');

async function testHistoricalData() {
  console.log('=== Testing NWSS with Historical Data ===\n');
  
  // Test with 2024 data (known to exist)
  const url = "https://data.cdc.gov/resource/2ew6-ywp6.json?$where=reporting_jurisdiction='California' AND date_end>='2024-01-01' AND date_end<='2024-12-31'&$limit=5&$order=date_end DESC";
  
  console.log('Fetching California 2024 data...');
  console.log('URL:', url);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`❌ HTTP ${res.statusCode}`);
          console.log(data);
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          const response = JSON.parse(data);
          console.log(`✅ Success: ${response.length} records`);
          if (response.length > 0) {
            console.log('\nSample record:');
            console.log(JSON.stringify(response[0], null, 2));
          }
          resolve(response);
        }
      });
    }).on('error', reject);
  });
}

testHistoricalData().catch(console.error);
