/**
 * Test script for IDWR API connectivity
 * Tests different URL formats and years
 */

const https = require('https');

async function testIDWRURL(url, description) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`URL: ${url}`);
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log(`✅ Success: ${data.length} bytes received`);
          console.log('First 200 chars:', data.substring(0, 200));
          resolve({ success: true, status: 200 });
        });
      } else if (res.statusCode === 302 || res.statusCode === 301) {
        console.log(`Redirect to: ${res.headers.location}`);
        resolve({ success: false, status: res.statusCode, redirect: res.headers.location });
      } else {
        console.log(`❌ Failed: HTTP ${res.statusCode}`);
        resolve({ success: false, status: res.statusCode });
      }
    }).on('error', (error) => {
      console.error('Request error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

async function runTests() {
  console.log('=== IDWR API Connectivity Tests ===');
  
  // Test 1: Check if base URL is accessible
  await testIDWRURL('https://id-info.jihs.go.jp/surveillance/idwr/', 'Base URL');
  
  // Test 2: Try 2024 data (recent year)
  await testIDWRURL('https://id-info.jihs.go.jp/surveillance/idwr/2024/data202401.csv', '2024 Week 01');
  
  // Test 3: Try 2023 data
  await testIDWRURL('https://id-info.jihs.go.jp/surveillance/idwr/2023/data202301.csv', '2023 Week 01');
  
  // Test 4: Try different format (without year in filename)
  await testIDWRURL('https://id-info.jihs.go.jp/surveillance/idwr/2024/data01.csv', '2024 Week 01 (alt format)');
  
  // Test 5: Check if there's a different path structure
  await testIDWRURL('https://id-info.jihs.go.jp/idwr/2024/data202401.csv', 'Alternative path structure');
  
  console.log('\n✅ All tests completed');
}

runTests();
