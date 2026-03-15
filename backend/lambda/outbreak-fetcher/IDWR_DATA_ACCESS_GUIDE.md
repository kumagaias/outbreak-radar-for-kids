# IDWR Data Access Guide

## Current Status

**Implementation**: Complete with fallback to mock data  
**Issue**: SSL certificate mismatch prevents automated access  
**Workaround**: System uses historical mock data when real data unavailable

## Data Source Information

### Official IDWR Website

**Base URL**: `https://idsc.nih.go.jp/en/surveillance/idwr/rapid/`

**URL Pattern for Weekly Data**:
```
https://idsc.nih.go.jp/en/surveillance/idwr/rapid/{year}/{week}/index.html
```

**Examples**:
- 2025 Week 10: https://idsc.nih.go.jp/en/surveillance/idwr/rapid/2025/10/index.html
- 2025 Week 25: https://idsc.nih.go.jp/en/surveillance/idwr/rapid/2025/25/index.html

### Data Format

Data is published as HTML tables on weekly pages, not as downloadable CSV files.

**Available Data**:
1. Notifiable Diseases (全数把握疾患)
   - Number of cases by week and prefecture
   - Cumulative totals

2. Sentinel-Reporting Diseases (定点把握疾患)
   - Weekly case counts
   - Cases per sentinel site
   - By prefecture

**Key Diseases for Our System**:
- RSV (RSウイルス感染症)
- Influenza (インフルエンザ)
- Hand-Foot-Mouth Disease (手足口病)
- Herpangina (ヘルパンギーナ)
- Infectious Gastroenteritis/Norovirus (感染性胃腸炎)
- COVID-19 (新型コロナウイルス感染症)
- Measles (麻疹)
- Mpox (サル痘)

## Technical Issues

### SSL Certificate Mismatch

**Problem**: 
- Domain `idsc.nih.go.jp` returns certificate for `id-info.jihs.go.jp`
- Node.js HTTPS client rejects connection due to hostname mismatch

**Error Message**:
```
Network error: Hostname/IP does not match certificate's altnames: 
Host: idsc.nih.go.jp. is not in the cert's altnames: DNS:id-info.jihs.go.jp
```

**Root Cause**:
- NIID (National Institute of Infectious Diseases) merged with NCGM on April 1, 2025
- New organization: JIHS (Japan Institute for Health Security)
- Website infrastructure in transition
- DNS/SSL configuration not fully updated

### Previous CSV Access Attempt

**Old URL Pattern** (no longer works):
```
https://id-info.jihs.go.jp/surveillance/idwr/{year}/data{year}{week}.csv
```

**Result**: 404 Not Found

**Conclusion**: CSV files are no longer published at this location

## Implementation Options

### Option 1: HTML Scraping (Recommended for MVP)

**Approach**: Parse HTML tables from weekly pages

**Pros**:
- Data is publicly available
- No API key required
- Most reliable access method

**Cons**:
- HTML structure may change
- Requires robust parsing logic
- Slower than API access

**Implementation Steps**:
1. Install HTML parsing library: `npm install cheerio`
2. Fetch HTML page for specific week
3. Parse tables using CSS selectors
4. Extract disease names, case counts, prefectures
5. Handle Shift-JIS encoding if needed

**Example Code Structure**:
```javascript
const cheerio = require('cheerio');
const https = require('https');

async function fetchIDWRHTML(year, week) {
  const url = `https://idsc.nih.go.jp/en/surveillance/idwr/rapid/${year}/${week}/index.html`;
  // Fetch HTML with SSL verification disabled (rejectUnauthorized: false)
  // Parse with cheerio
  // Extract table data
}
```

### Option 2: Wait for SSL Fix

**Approach**: Monitor website for SSL certificate fix

**Timeline**: Unknown (depends on JIHS infrastructure team)

**Action**: Check periodically if certificate issue is resolved

### Option 3: Use Mock Data (Current Implementation)

**Approach**: Generate realistic mock data based on historical patterns

**Pros**:
- System remains functional
- No external dependencies
- Predictable behavior

**Cons**:
- Not real-time data
- Less accurate risk assessments

**Status**: Currently implemented and working

## Recommended Next Steps

### For MVP Launch
1. Continue using mock data fallback
2. Document limitation in user-facing materials
3. Monitor IDWR website for SSL fix

### Post-MVP (Priority 2)
1. Implement HTML scraping solution (Option 1)
2. Add robust error handling for HTML structure changes
3. Test with multiple weeks of data
4. Deploy and monitor

### Long-term
1. Contact JIHS to request:
   - API access for programmatic data retrieval
   - CSV export functionality
   - SSL certificate fix for idsc.nih.go.jp domain
2. Consider alternative data sources if available

## Testing

### Manual Testing
```bash
# Test current implementation (uses mock data)
cd backend/lambda/outbreak-fetcher
node test-japan-sources.js
```

### Expected Behavior
- IDWR fetch fails with 404 or SSL error
- System automatically falls back to mock data
- Mock data provides 6 disease records (RSV, Influenza, Hand-Foot-Mouth, Herpangina, Norovirus, COVID-19)

## References

- IDWR Main Page: https://idsc.nih.go.jp/en/surveillance/idwr/rapid/2025/index.html
- JIHS Official Site: https://www.jihs.go.jp/en/
- Surveillance Data Archive: https://idsc.nih.go.jp/surveillance/idwr/idwr/2024/year-data/teiten/index.html

## Contact

For questions about IDWR data access:
- JIHS Contact: https://www.jihs.go.jp/en/contact.html
- Surveillance Division: (contact information to be added)
