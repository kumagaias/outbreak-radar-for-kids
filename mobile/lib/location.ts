import * as Location from "expo-location";
import type { Country } from "./mock-data";

// Prefecture/State boundaries (simplified - center coordinates)
const JP_PREFECTURES: Record<string, { lat: number; lng: number }> = {
  "北海道": { lat: 43.06, lng: 141.35 },
  "青森県": { lat: 40.82, lng: 140.74 },
  "岩手県": { lat: 39.70, lng: 141.15 },
  "宮城県": { lat: 38.27, lng: 140.87 },
  "秋田県": { lat: 39.72, lng: 140.10 },
  "山形県": { lat: 38.24, lng: 140.36 },
  "福島県": { lat: 37.75, lng: 140.47 },
  "茨城県": { lat: 36.34, lng: 140.45 },
  "栃木県": { lat: 36.57, lng: 139.88 },
  "群馬県": { lat: 36.39, lng: 139.06 },
  "埼玉県": { lat: 35.86, lng: 139.65 },
  "千葉県": { lat: 35.61, lng: 140.12 },
  "東京都": { lat: 35.69, lng: 139.69 },
  "神奈川県": { lat: 35.45, lng: 139.64 },
  "新潟県": { lat: 37.90, lng: 139.02 },
  "富山県": { lat: 36.70, lng: 137.21 },
  "石川県": { lat: 36.59, lng: 136.63 },
  "福井県": { lat: 36.07, lng: 136.22 },
  "山梨県": { lat: 35.66, lng: 138.57 },
  "長野県": { lat: 36.65, lng: 138.18 },
  "岐阜県": { lat: 35.39, lng: 136.72 },
  "静岡県": { lat: 34.98, lng: 138.38 },
  "愛知県": { lat: 35.18, lng: 136.91 },
  "三重県": { lat: 34.73, lng: 136.51 },
  "滋賀県": { lat: 35.00, lng: 135.87 },
  "京都府": { lat: 35.02, lng: 135.76 },
  "大阪府": { lat: 34.69, lng: 135.50 },
  "兵庫県": { lat: 34.69, lng: 135.18 },
  "奈良県": { lat: 34.69, lng: 135.83 },
  "和歌山県": { lat: 34.23, lng: 135.17 },
  "鳥取県": { lat: 35.50, lng: 134.23 },
  "島根県": { lat: 35.47, lng: 133.05 },
  "岡山県": { lat: 34.66, lng: 133.92 },
  "広島県": { lat: 34.40, lng: 132.46 },
  "山口県": { lat: 34.19, lng: 131.47 },
  "徳島県": { lat: 34.07, lng: 134.56 },
  "香川県": { lat: 34.34, lng: 134.04 },
  "愛媛県": { lat: 33.84, lng: 132.77 },
  "高知県": { lat: 33.56, lng: 133.53 },
  "福岡県": { lat: 33.61, lng: 130.42 },
  "佐賀県": { lat: 33.25, lng: 130.30 },
  "長崎県": { lat: 32.74, lng: 129.87 },
  "熊本県": { lat: 32.79, lng: 130.74 },
  "大分県": { lat: 33.24, lng: 131.61 },
  "宮崎県": { lat: 31.91, lng: 131.42 },
  "鹿児島県": { lat: 31.56, lng: 130.56 },
  "沖縄県": { lat: 26.21, lng: 127.68 },
};

const US_STATES: Record<string, { lat: number; lng: number }> = {
  "Alabama": { lat: 32.8, lng: -86.8 },
  "Alaska": { lat: 64.0, lng: -152.0 },
  "Arizona": { lat: 34.3, lng: -111.7 },
  "Arkansas": { lat: 34.9, lng: -92.4 },
  "California": { lat: 36.8, lng: -119.4 },
  "Colorado": { lat: 39.0, lng: -105.5 },
  "Connecticut": { lat: 41.6, lng: -72.7 },
  "Delaware": { lat: 39.0, lng: -75.5 },
  "Florida": { lat: 27.8, lng: -81.7 },
  "Georgia": { lat: 32.9, lng: -83.6 },
  "Hawaii": { lat: 21.1, lng: -157.5 },
  "Idaho": { lat: 44.2, lng: -114.5 },
  "Illinois": { lat: 40.3, lng: -89.0 },
  "Indiana": { lat: 39.8, lng: -86.3 },
  "Iowa": { lat: 42.0, lng: -93.2 },
  "Kansas": { lat: 38.5, lng: -96.7 },
  "Kentucky": { lat: 37.7, lng: -84.9 },
  "Louisiana": { lat: 31.2, lng: -91.8 },
  "Maine": { lat: 44.7, lng: -69.4 },
  "Maryland": { lat: 39.0, lng: -76.8 },
  "Massachusetts": { lat: 42.2, lng: -71.5 },
  "Michigan": { lat: 43.3, lng: -84.5 },
  "Minnesota": { lat: 45.7, lng: -93.9 },
  "Mississippi": { lat: 32.7, lng: -89.7 },
  "Missouri": { lat: 38.5, lng: -92.3 },
  "Montana": { lat: 46.9, lng: -110.4 },
  "Nebraska": { lat: 41.1, lng: -98.3 },
  "Nevada": { lat: 38.3, lng: -117.1 },
  "New Hampshire": { lat: 43.5, lng: -71.6 },
  "New Jersey": { lat: 40.3, lng: -74.5 },
  "New Mexico": { lat: 34.8, lng: -106.2 },
  "New York": { lat: 42.2, lng: -74.9 },
  "North Carolina": { lat: 35.6, lng: -79.8 },
  "North Dakota": { lat: 47.5, lng: -99.8 },
  "Ohio": { lat: 40.4, lng: -82.8 },
  "Oklahoma": { lat: 35.6, lng: -96.9 },
  "Oregon": { lat: 44.6, lng: -122.1 },
  "Pennsylvania": { lat: 40.6, lng: -77.2 },
  "Rhode Island": { lat: 41.7, lng: -71.5 },
  "South Carolina": { lat: 33.8, lng: -80.9 },
  "South Dakota": { lat: 44.3, lng: -99.4 },
  "Tennessee": { lat: 35.7, lng: -86.7 },
  "Texas": { lat: 31.1, lng: -97.6 },
  "Utah": { lat: 40.2, lng: -111.5 },
  "Vermont": { lat: 44.0, lng: -72.7 },
  "Virginia": { lat: 37.8, lng: -78.2 },
  "Washington": { lat: 47.4, lng: -121.5 },
  "West Virginia": { lat: 38.5, lng: -80.9 },
  "Wisconsin": { lat: 44.3, lng: -89.8 },
  "Wyoming": { lat: 42.8, lng: -107.3 },
};

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function detectCountryFromCoords(lat: number, lng: number): Country {
  // Simple heuristic: Japan is roughly 24-46°N, 123-146°E
  // US is roughly 25-49°N, -125 to -66°W
  if (lat >= 24 && lat <= 46 && lng >= 123 && lng <= 146) {
    return "JP";
  }
  // Default to US for other locations
  return "US";
}

function findNearestArea(
  lat: number,
  lng: number,
  areas: Record<string, { lat: number; lng: number }>
): string | null {
  let nearest: string | null = null;
  let minDistance = Infinity;

  for (const [area, coords] of Object.entries(areas)) {
    const distance = calculateDistance(lat, lng, coords.lat, coords.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = area;
    }
  }

  return nearest;
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error requesting location permission:", error);
    return false;
  }
}

export async function getCurrentArea(country: Country): Promise<string | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    if (country === "JP") {
      return findNearestArea(latitude, longitude, JP_PREFECTURES);
    } else {
      return findNearestArea(latitude, longitude, US_STATES);
    }
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
}

export async function getCurrentCountryAndArea(): Promise<{
  country: Country;
  area: string;
} | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;
    const country = detectCountryFromCoords(latitude, longitude);

    let area: string | null = null;
    if (country === "JP") {
      area = findNearestArea(latitude, longitude, JP_PREFECTURES);
    } else {
      area = findNearestArea(latitude, longitude, US_STATES);
    }

    if (!area) {
      return null;
    }

    return { country, area };
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
}
