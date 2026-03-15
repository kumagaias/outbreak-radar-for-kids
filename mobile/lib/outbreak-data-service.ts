/**
 * Outbreak Data Service
 * Fetches real outbreak data from Backend API
 */

import type { Country } from './mock-data';

const API_ENDPOINT = 'https://hexygw1gca.execute-api.ap-northeast-1.amazonaws.com/dev';

export interface RealOutbreakData {
  area: string;
  country: Country;
  diseaseId: string;
  diseaseName: string;
  diseaseNameLocal: string;
  level: 'low' | 'medium' | 'high';
  cases: number;
  weeklyChange: number;
  lastUpdated: Date;
  sewerageVirusLevel?: number;
  hospitalizations?: number;
  schoolClosures?: number;
  peakWeek?: string;
}

/**
 * Fetch real outbreak data for a geographic area
 * @param area - State/prefecture name
 * @param country - Country code (JP or US)
 * @returns Array of outbreak data
 */
export async function fetchOutbreakData(
  area: string,
  country: Country
): Promise<RealOutbreakData[]> {
  try {
    const url = `${API_ENDPOINT}/outbreak-data?area=${encodeURIComponent(area)}&country=${country}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Transform dates from ISO strings to Date objects
    return (result.data || []).map((item: any) => ({
      ...item,
      lastUpdated: new Date(item.lastUpdated),
    }));
  } catch (error) {
    console.error('Error fetching outbreak data:', error);
    throw error;
  }
}
