/**
 * Test script for Japanese data sources (IDWR and e-Stat)
 * 
 * Tests:
 * 1. IDWR CSV fetching and parsing
 * 2. e-Stat API integration (if API key available)
 */

const idwr = require('./src/sources/idwr');
const estat = require('./src/sources/estat');

async function testIDWR() {
  console.log('\n=== Testing IDWR Data Source ===\n');
  
  try {
    // Test with recent week (2024 week 10 - early March)
    const year = 2024;
    const week = 10;
    
    console.log(`Fetching IDWR data for ${year} week ${week}...`);
    const records = await idwr.fetchWeekData(year, week);
    
    console.log(`✓ Successfully fetched ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\nSample records:');
      records.slice(0, 5).forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.disease} (${record.diseaseJa})`);
        console.log(`   Prefecture: ${record.prefecture}`);
        console.log(`   Cases: ${record.caseCount}`);
        console.log(`   Week: ${record.reportYear}-W${record.reportWeek}`);
      });
      
      // Check for key diseases
      const diseases = [...new Set(records.map(r => r.disease))];
      console.log(`\nDiseases found: ${diseases.join(', ')}`);
      
      const rsv = records.find(r => r.disease === 'RSV');
      const influenza = records.find(r => r.disease === 'Influenza');
      const norovirus = records.find(r => r.disease === 'Norovirus');
      
      console.log('\nKey disease availability:');
      console.log(`  RSV: ${rsv ? '✓' : '✗'}`);
      console.log(`  Influenza: ${influenza ? '✓' : '✗'}`);
      console.log(`  Norovirus: ${norovirus ? '✓' : '✗'}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ IDWR test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function testEStat() {
  console.log('\n=== Testing e-Stat Data Source ===\n');
  
  try {
    // Check if API key is available
    const apiKey = await estat.getEStatAPIKey();
    
    if (!apiKey) {
      console.log('⚠ e-Stat API key not found in Secrets Manager');
      console.log('  Skipping e-Stat test (optional data source)');
      return true;  // Not a failure - e-Stat is optional
    }
    
    console.log('✓ e-Stat API key found');
    
    // Test norovirus data fetching
    console.log('\nFetching norovirus data...');
    const records = await estat.fetchNorovirusData({
      year: 2024,
      prefecture: 'Tokyo'
    });
    
    console.log(`✓ Successfully fetched ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\nSample records:');
      records.slice(0, 3).forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.disease}`);
        console.log(`   Prefecture: ${record.prefecture}`);
        console.log(`   Cases: ${record.caseCount}`);
        console.log(`   Period: ${record.reportYear}-${record.reportMonth || record.reportWeek}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error(`✗ e-Stat test failed: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function main() {
  console.log('Testing Japanese Data Sources');
  console.log('==============================');
  
  const idwrSuccess = await testIDWR();
  const estatSuccess = await testEStat();
  
  console.log('\n=== Test Summary ===\n');
  console.log(`IDWR: ${idwrSuccess ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`e-Stat: ${estatSuccess ? '✓ PASS' : '✗ FAIL (optional)'}`);
  
  if (idwrSuccess) {
    console.log('\n✓ Japanese data sources are operational');
    console.log('  IDWR provides: RSV, Influenza, Norovirus, Hand-Foot-Mouth Disease, etc.');
    if (estatSuccess) {
      console.log('  e-Stat provides: Additional norovirus data');
    }
  } else {
    console.log('\n✗ IDWR test failed - Japanese users will not get accurate recommendations');
    process.exit(1);
  }
}

main();
