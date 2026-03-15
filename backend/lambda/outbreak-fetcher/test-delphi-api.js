/**
 * Test script for Delphi Epidata API connectivity
 * Tests FluView and FluSurv-NET endpoints
 */

const https = require('https');

// Test FluView API
async function testFluView() {
  console.log('\n=== Testing FluView API ===');
  
  const url = 'https://api.delphi.cmu.edu/epidata/fluview/?regions=nat&epiweeks=202401-202410';
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('Parse error:', error.message);
          console.log('Raw data:', data.substring(0, 500));
          reject(error);
        }
      });
    }).on('error', (error) => {
      console.error('Request error:', error.message);
      reject(error);
    });
  });
}

// Test FluSurv-NET API
async function testFluSurv() {
  console.log('\n=== Testing FluSurv-NET API ===');
  
  const url = 'https://api.delphi.cmu.edu/epidata/flusurv/?locations=network_all&epiweeks=202401-202410';
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.error('Parse error:', error.message);
          console.log('Raw data:', data.substring(0, 500));
          reject(error);
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
    await testFluView();
    await testFluSurv();
    console.log('\n✅ All tests completed');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
