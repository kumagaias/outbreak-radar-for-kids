/**
 * Test fixed NWSS implementation
 */

const { fetchNWSSData } = require('./src/sources/nwss');

async function testNWSSFixed() {
  console.log('=== Testing Fixed NWSS Implementation ===\n');
  
  try {
    // Test with California
    console.log('Test 1: Fetching California data...');
    const caData = await fetchNWSSData({ state: 'California', daysBack: 30 });
    console.log(`✅ Success: ${caData.length} records fetched`);
    if (caData.length > 0) {
      console.log('Sample record:', JSON.stringify(caData[0], null, 2));
    }
    
    // Test with New York
    console.log('\nTest 2: Fetching New York data...');
    const nyData = await fetchNWSSData({ state: 'New York', daysBack: 30 });
    console.log(`✅ Success: ${nyData.length} records fetched`);
    
    // Test with county filter
    console.log('\nTest 3: Fetching Los Angeles County data...');
    const laData = await fetchNWSSData({ state: 'California', county: 'Los Angeles', daysBack: 30 });
    console.log(`✅ Success: ${laData.length} records fetched`);
    
    console.log('\n✅ All NWSS tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testNWSSFixed();
