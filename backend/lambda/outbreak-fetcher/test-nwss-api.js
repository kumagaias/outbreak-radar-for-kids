/**
 * Test script for CDC NWSS API connectivity
 * Tests SODA API with different query formats
 */

const https = require('https');

// Test NWSS API with different query formats
async function testNWSSQuery(queryParams, description) {
  console.log(`\n=== Testing: ${description} ===`);
  
  const url = `https://data.cdc.gov/resource/2ew6-ywp6.json?${queryParams}`;
  console.log(`URL: ${url}`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`Error: HTTP ${res.statusCode}`);
          console.log('Response:', data.substring(0, 500));
          resolve({ success: false, status: res.statusCode, data });
        } else {
          try {
            const response = JSON.parse(data);
            console.log(`Success: ${response.length} records`);
            if (response.length > 0) {
              console.log('Sample record:', JSON.stringify(response[0], null, 2));
            }
            resolve({ success: true, status: res.statusCode, count: response.length });
          } catch (error) {
            console.error('Parse error:', error.message);
            resolve({ success: false, error: error.message });
          }
        }
      });
    }).on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });
  });
}

// Run tests
async function runTests() {
  try {
    // Test 1: Simple limit query (no filters)
    await testNWSSQuery('$limit=5', 'Simple query with limit');
    
    // Test 2: Date filter with ISO format
    const dateStr = '2024-01-01';
    await testNWSSQuery(`$where=date>='${dateStr}'&$limit=5`, 'Date filter (ISO format)');
    
    // Test 3: State filter
    await testNWSSQuery(`$where=state='CA'&$limit=5`, 'State filter (CA)');
    
    // Test 4: Combined filters (original implementation)
    await testNWSSQuery(`$where=state='CA' AND date>='${dateStr}'&$limit=5&$order=date DESC`, 'Combined filters');
    
    // Test 5: Check available fields
    await testNWSSQuery('$limit=1', 'Check field names');
    
    console.log('\n✅ All tests completed');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
