# Outbreak Data Sources

This directory contains data fetchers for various outbreak surveillance systems.

## CDC NWSS (National Wastewater Surveillance System)

**File**: `nwss.js`

Fetches wastewater surveillance data for SARS-CoV-2, Influenza A, RSV, Measles, Mpox, and H5 from CDC's SODA API.

### Usage

```javascript
const { fetchNWSSData } = require('./sources/nwss');

// Fetch data for a state
const data = await fetchNWSSData({ 
  state: 'CA',
  daysBack: 30 
});

// Fetch data for a specific county
const countyData = await fetchNWSSData({ 
  state: 'NY',
  county: 'New York',
  daysBack: 30 
});

// Fetch data for a specific disease
const diseaseData = await fetchNWSSData({ 
  state: 'TX',
  disease: 'Influenza A',
  daysBack: 30 
});
```

### Parameters

- `state` (required): US state abbreviation (e.g., 'CA', 'NY', 'TX')
- `county` (optional): County name for county-level filtering
- `disease` (optional): Specific disease to filter (must be one of supported diseases)
- `daysBack` (optional): Number of days to look back (default: 30)

### Supported Diseases

- SARS-CoV-2 (mapped to "COVID-19")
- Influenza A
- RSV
- Measles
- Mpox
- H5 (mapped to "H5 Avian Influenza")

### Response Format

```javascript
[
  {
    source: 'NWSS',
    diseaseId: 'SARS-CoV-2',
    diseaseName: 'COVID-19',
    date: '2024-03-10',
    geographicUnit: {
      country: 'US',
      stateOrPrefecture: 'CA',
      countyOrWard: 'Los Angeles'
    },
    metrics: {
      wastewaterActivityLevel: 75.5,    // 0-100 percentile
      detectionProportion: 85.2,        // 0-100 percentage
      percentChange15d: 12.3,           // Trend indicator
      rawPercentile: '75.5'
    },
    timestamp: '2024-03-12T10:30:00.000Z'
  }
]
```

### API Details

- **Endpoint**: https://data.cdc.gov/resource/2ew6-ywp6.json
- **Dataset**: 2ew6-ywp6 (Public SARS-CoV-2 Wastewater Metric Data)
- **Protocol**: SODA API (Socrata Open Data API)
- **Authentication**: None required
- **Rate Limit**: Standard SODA API limits apply
- **Timeout**: 10 seconds

### Error Handling

The fetcher handles the following error scenarios:

- Missing required parameters (throws error)
- Network errors (throws error with message)
- HTTP non-200 status codes (throws error with status)
- Request timeout (throws error after 10 seconds)
- Malformed JSON response (throws error)
- Invalid records (skips and continues processing)

### Testing

Run tests with:

```bash
npm test
```

Coverage: 97.22%

## Delphi Epidata FluSurv-NET

**File**: `flusurv.js`

Fetches age-stratified hospitalization rate data for laboratory-confirmed influenza from CDC FluSurv-NET via Delphi Epidata API. Prioritizes children under 18 years with granular age groups.

### Usage

```javascript
const { fetchFluSurvData, fetchLocationData, getAgeSpecificRate } = require('./sources/flusurv');

// Fetch data for network-wide surveillance
const data = await fetchFluSurvData({ 
  locations: 'network_all',
  epiweeks: '202401-202410'
});

// Fetch data for a specific state
const stateData = await fetchLocationData('ca', '202401-202410');

// Get age-specific rate for app age range
const ageGroupRates = {
  '0-1': 5.2,
  '1-4': 3.8,
  '5-11': 2.1,
  '12-17': 1.5
};
const rate = getAgeSpecificRate(ageGroupRates, '2-3'); // Returns 3.8
```

### Parameters

- `locations` (required): FluSurv-NET locations (e.g., 'network_all', 'ca', 'ny')
- `epiweeks` (required): Epiweeks range in format 'YYYYWW-YYYYWW' (e.g., '202401-202410')

### Age Groups

FluSurv-NET provides granular age stratification, especially for children:

- **0-1 years**: Infants
- **1-4 years**: Toddlers and preschoolers
- **5-11 years**: Elementary school age
- **12-17 years**: Middle and high school age
- **18-49 years**: Young adults
- **50-64 years**: Middle-aged adults
- **65+ years**: Older adults

### App Age Range Mapping

The system maps app age ranges to FluSurv-NET age groups (Requirement 19.24):

- **App 0-1 years** → FluSurv-NET 0-1 years
- **App 2-3 years** → FluSurv-NET 1-4 years
- **App 4-6 years** → FluSurv-NET 5-11 years (conservative)
- **App 7+ years** → FluSurv-NET 12-17 years (prefers 12-17, falls back to 5-11)

### Supported Diseases

- Influenza A
- Influenza B

### Response Format

```javascript
[
  {
    location: 'network_all',
    epiweek: 202401,
    year: 2024,
    week: 1,
    ageGroupRates: {
      '0-1': 5.2,      // Rate per 100,000 population
      '1-4': 3.8,
      '5-11': 2.1,
      '12-17': 1.5,
      '18-49': 0.8,
      '50-64': 1.2,
      '65+': 4.5
    },
    overallRate: 2.3,  // Overall rate per 100,000
    lag: 1             // Data lag in weeks
  }
]
```

### API Details

- **Endpoint**: https://api.delphi.cmu.edu/epidata/flusurv
- **Provider**: CMU Delphi Epidata API
- **Authentication**: None required (open API)
- **Rate Limit**: No explicit limit
- **Timeout**: 10 seconds

### Key Features

1. **Child-Focused**: Prioritizes data for children under 18 years (Requirement 19.22)
2. **Age-Specific Risk**: Provides granular age stratification for accurate risk assessment
3. **Conservative Mapping**: Uses higher age groups when exact match unavailable (e.g., 4-6 years → 5-11 years)
4. **Fallback Logic**: Falls back to 5-11 years for 7+ age range when 12-17 unavailable

### Helper Functions

#### `filterChildAgeGroups(records)`

Filters records to include only those with child age group data (under 18 years).

```javascript
const childRecords = filterChildAgeGroups(allRecords);
```

#### `dateToEpiweek(date)`

Converts a Date object to epiweek format (YYYYWW).

```javascript
const epiweek = dateToEpiweek(new Date('2024-01-15')); // Returns 202403
```

#### `getRecentEpiweeksRange(weeksBack)`

Gets epiweeks range for the last N weeks.

```javascript
const range = getRecentEpiweeksRange(4); // Returns '202401-202404'
```

### Error Handling

The fetcher handles the following error scenarios:

- Missing required parameters (throws error)
- Network errors (throws error with message)
- HTTP non-200 status codes (throws error with status)
- API result !== 1 (throws error with API message)
- Request timeout (throws error after 10 seconds)
- Malformed JSON response (throws error)
- Invalid records (returns null, filtered out)
- Negative or NaN rates (skipped)

### Testing

Run tests with:

```bash
npm test -- flusurv.test.js
```

Coverage: 58.66% (core parsing and mapping functions fully tested)

## NIID IDWR (Infectious Disease Weekly Report)

**File**: `idwr.js`

Fetches weekly infectious disease reports from Japan's National Institute of Infectious Diseases (NIID). Data is provided in CSV format with Shift-JIS encoding.

### Usage

```javascript
const { fetchWeekData, fetchIDWRData, parseIDWRCSV } = require('./sources/idwr');

// Fetch and parse data for a specific week
const data = await fetchWeekData(2024, 10);

// Fetch raw CSV data
const csvData = await fetchIDWRData({ year: 2024, week: 10 });

// Parse CSV data
const records = parseIDWRCSV(csvData);
```

### Parameters

- `year` (required): Year (e.g., 2024)
- `week` (required): Week number (1-52)

### Supported Diseases

- RSウイルス感染症 (RSV)
- インフルエンザ (Influenza)
- 手足口病 (Hand-Foot-Mouth Disease)
- ヘルパンギーナ (Herpangina)
- 感染性胃腸炎 (Norovirus)
- 新型コロナウイルス感染症 (COVID-19)
- 麻疹 (Measles)
- サル痘 (Mpox)

### Response Format

```javascript
[
  {
    disease: 'RSV',
    diseaseJa: 'RSウイルス感染症',
    prefecture: '東京都',
    caseCount: 100,
    reportWeek: '10',
    reportYear: '2024'
  }
]
```

### API Details

- **Endpoint**: https://id-info.jihs.go.jp/surveillance/idwr/
- **Format**: CSV (Shift-JIS encoding)
- **Authentication**: None required
- **Timeout**: 15 seconds (longer for Japan data sources)

### Key Features

1. **Shift-JIS Encoding**: Handles Japanese character encoding using iconv-lite
2. **Robust CSV Parsing**: Handles quoted fields, commas in values, and malformed rows
3. **Disease Name Mapping**: Maps Japanese disease names to English equivalents
4. **Flexible Field Names**: Supports multiple CSV format variations across years

## e-Stat API (Japan Government Statistics)

**File**: `estat.js`

Fetches infectious disease surveillance data from Japan's government statistics portal (e-Stat). Focuses on norovirus data reported as "infectious gastroenteritis" (感染性胃腸炎).

### Usage

```javascript
const { fetchNorovirusData, fetchEStatData } = require('./sources/estat');

// Fetch norovirus data for a specific dataset
const data = await fetchNorovirusData({ 
  statsDataId: '0003411234',
  prefecture: '東京都',
  year: 2024,
  week: 10
});

// Fetch raw e-Stat data
const rawData = await fetchEStatData({
  statsDataId: '0003411234',
  cdCat01: '001',  // Disease category code
  cdArea: '13',    // Prefecture code (13 = Tokyo)
  limit: 10000
});
```

### Parameters

- `statsDataId` (required): Statistics dataset ID from e-Stat
- `prefecture` (optional): Prefecture name in Japanese (e.g., '東京都')
- `year` (optional): Year for filtering
- `week` (optional): Week number for filtering
- `cdCat01` (optional): Disease category code
- `cdArea` (optional): Area/prefecture code
- `limit` (optional): Maximum number of records (default: 10000)

### Supported Diseases

- 感染性胃腸炎 (Norovirus) - Reported as infectious gastroenteritis

### Prefecture Mapping

All 47 Japanese prefectures are supported with English name mapping:

- 北海道 (Hokkaido)
- 東京都 (Tokyo)
- 大阪府 (Osaka)
- 京都府 (Kyoto)
- 沖縄県 (Okinawa)
- ... and 42 more

### Response Format

```javascript
[
  {
    disease: 'Norovirus',
    diseaseJa: '感染性胃腸炎',
    prefecture: 'Tokyo',
    prefectureJa: '東京都',
    weekNumber: 10,
    year: 2024,
    caseCount: 150,
    per100kPopulation: null,  // May be added in future
    timestamp: '2024-03-12T10:30:00.000Z'
  }
]
```

### API Details

- **Endpoint**: https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData
- **Authentication**: Application ID (appId) required
- **Credential Storage**: AWS Secrets Manager
- **Secret Name**: Configured via `ESTAT_SECRET_NAME` environment variable (default: 'estat-api-key')
- **Timeout**: 10 seconds

### Authentication

The e-Stat API requires an application ID obtained from https://www.e-stat.go.jp/api/

**Credential Management**:

1. Register for e-Stat API access and obtain application ID
2. Store credential in AWS Secrets Manager with one of these field names:
   - `appId`
   - `apiKey`
   - `api_key`
3. Lambda function retrieves credential at runtime using AWS SDK v3

**Example Secret Format**:

```json
{
  "appId": "your-application-id-here"
}
```

### Key Features

1. **Secure Credential Management**: Uses AWS Secrets Manager for API key storage
2. **Flexible Response Parsing**: Handles e-Stat's complex JSON structure with CLASS_OBJ mappings
3. **Prefecture Name Mapping**: Converts Japanese prefecture names to English
4. **Time Code Parsing**: Extracts year and week from YYYYWW format
5. **Filtering Support**: Client-side filtering by prefecture, year, and week

### Error Handling

The fetcher handles the following error scenarios:

- Missing required parameters (throws error)
- Secrets Manager access errors (throws error with message)
- Missing or invalid API key in secret (throws error)
- Network errors (throws error with message)
- HTTP non-200 status codes (throws error with status)
- e-Stat API errors (STATUS !== 0) (throws error with API message)
- Request timeout (throws error after 10 seconds)
- Malformed JSON response (throws error)
- Invalid records (returns null, filtered out)

### Testing

Run tests with:

```bash
npm test -- estat.test.js
```

Coverage: 99.18%

## Future Data Sources

The following data sources may be implemented in future enhancements:

- **WastewaterSCAN** (Optional): Additional wastewater coverage
- **CDC NHSN** (Optional): Hospital admission data
- **Delphi Epidata FluView** (Optional): ILI surveillance
- **Tokyo Metropolitan Infectious Disease Surveillance Center** (Optional): Tokyo-specific data
