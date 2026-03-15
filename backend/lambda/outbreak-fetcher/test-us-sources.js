/**
 * Test script for US data sources (NWSS, NHSN, FluView, FluSurv-NET)
 * 
 * Tests:
 * 1. CDC NWSS wastewater surveillance data
 * 2. CDC NHSN hospital admission data
 * 3. Delphi Epidata FluView ILI data
 * 4. Delphi Epidata FluSurv-NET hospitalization rates
 */

const nwss = require('./src/sources/nwss');
const nhsn = require('./src/sources/nhsn');
const fluview = require('./src/sources/fluview');
const flusurv = require('./src/sources/flusurv');

async function testNWSS() {
  console.log('\n=== Testing CDC NWSS (Wastewater Surveillance) ===\n');
  
  try {
    console.log('Fetching NWSS data for California (last 30 days)...');
    const records = await nwss.fetchNWSSData({ state: 'CA', daysBack: 30 });
    
    console.log(`✓ Successfully fetched ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\nSample records:');
      records.slice(0, 3).forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.disease || 'Unknown disease'}`);
        console.log(`   Location: ${record.state}, ${record.county || 'State-level'}`);
        console.log(`   Metric: ${record.metric}`);
        console.log(`   Value: ${record.value}`);
        console.log(`   Date: ${record.date}`);
      });
      
      // Check for key diseases
      const diseases = [...new Set(records.map(r => r.disease).filter(Boolean))];
      console.log(`\nDiseases found: ${diseases.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ NWSS test failed: ${error.message}`);
    return false;
  }
}

async function testNHSN() {
  console.log('\n=== Testing CDC NHSN (Hospital Admissions) ===\n');
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    console.log('Fetching NHSN data for California (last 30 days)...');
    const records = await nhsn.fetchStateData('CA', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    console.log(`✓ Successfully fetched ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\nSample records:');
      records.slice(0, 3).forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.disease || 'Unknown disease'}`);
        console.log(`   State: ${record.state}`);
        console.log(`   Admissions: ${record.admissions}`);
        console.log(`   Week ending: ${record.weekEndingDate}`);
      });
      
      // Check for key diseases
      const diseases = [...new Set(records.map(r => r.disease).filter(Boolean))];
      console.log(`\nDiseases found: ${diseases.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ NHSN test failed: ${error.message}`);
    return false;
  }
}

async function testFluView() {
  console.log('\n=== Testing Delphi Epidata FluView (ILI Surveillance) ===\n');
  
  try {
    const epiweeksRange = flusurv.getRecentEpiweeksRange(4);
    console.log(`Fetching FluView data for California (epiweeks: ${epiweeksRange})...`);
    
    const records = await fluview.fetchStateData('CA', epiweeksRange);
    
    console.log(`✓ Successfully fetched ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\nSample records:');
      records.slice(0, 3).forEach((record, index) => {
        console.log(`\n${index + 1}. ILI Surveillance`);
        console.log(`   State: ${record.state}`);
        console.log(`   ILI Rate: ${record.iliRate}%`);
        console.log(`   Epiweek: ${record.epiweek}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error(`✗ FluView test failed: ${error.message}`);
    return false;
  }
}

async function testFluSurv() {
  console.log('\n=== Testing Delphi Epidata FluSurv-NET (Hospitalization Rates) ===\n');
  
  try {
    const epiweeksRange = flusurv.getRecentEpiweeksRange(4);
    console.log(`Fetching FluSurv-NET data for California (epiweeks: ${epiweeksRange})...`);
    
    const records = await flusurv.fetchLocationData('CA', epiweeksRange);
    
    console.log(`✓ Successfully fetched ${records.length} records`);
    
    if (records.length > 0) {
      console.log('\nSample records:');
      records.slice(0, 3).forEach((record, index) => {
        console.log(`\n${index + 1}. Hospitalization Rate`);
        console.log(`   Location: ${record.location}`);
        console.log(`   Age Group: ${record.ageGroup}`);
        console.log(`   Rate: ${record.rate} per 100,000`);
        console.log(`   Epiweek: ${record.epiweek}`);
      });
      
      // Check age groups
      const ageGroups = [...new Set(records.map(r => r.ageGroup).filter(Boolean))];
      console.log(`\nAge groups found: ${ageGroups.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ FluSurv-NET test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Testing US Data Sources');
  console.log('=======================');
  
  const nwssSuccess = await testNWSS();
  const nhsnSuccess = await testNHSN();
  const fluviewSuccess = await testFluView();
  const flusurvSuccess = await testFluSurv();
  
  console.log('\n=== Test Summary ===\n');
  console.log(`NWSS (Wastewater): ${nwssSuccess ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`NHSN (Hospital Admissions): ${nhsnSuccess ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`FluView (ILI): ${fluviewSuccess ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`FluSurv-NET (Hospitalization): ${flusurvSuccess ? '✓ PASS' : '✗ FAIL'}`);
  
  const allSuccess = nwssSuccess && nhsnSuccess && fluviewSuccess && flusurvSuccess;
  
  if (allSuccess) {
    console.log('\n✓ All US data sources are operational');
    console.log('  System can provide accurate risk assessments for US users');
  } else {
    console.log('\n⚠ Some US data sources failed');
    console.log('  System will use available data sources and fallback logic');
  }
  
  process.exit(allSuccess ? 0 : 1);
}

main();
