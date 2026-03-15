/**
 * Test script for IDWR CSV fetching
 * Run with: node test-idwr.js
 */

const { fetchWeekData } = require('./src/sources/idwr');

async function testIDWR() {
  try {
    console.log('Testing IDWR CSV fetch for 2025 Week 9...\n');
    
    const records = await fetchWeekData(2025, 9, 2);
    
    console.log(`\nSuccessfully fetched ${records.length} records\n`);
    
    // Group by disease
    const byDisease = {};
    records.forEach(record => {
      if (!byDisease[record.disease]) {
        byDisease[record.disease] = [];
      }
      byDisease[record.disease].push(record);
    });
    
    // Display summary
    console.log('Summary by disease:');
    console.log('='.repeat(60));
    for (const [disease, diseaseRecords] of Object.entries(byDisease)) {
      const totalCases = diseaseRecords.reduce((sum, r) => sum + r.caseCount, 0);
      const prefectures = diseaseRecords.length;
      console.log(`${disease}: ${totalCases} cases across ${prefectures} prefectures`);
    }
    
    // Display sample records
    console.log('\nSample records (first 10):');
    console.log('='.repeat(60));
    records.slice(0, 10).forEach(record => {
      console.log(`${record.prefecture}: ${record.disease} (${record.diseaseJa}) - ${record.caseCount} cases`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testIDWR();
