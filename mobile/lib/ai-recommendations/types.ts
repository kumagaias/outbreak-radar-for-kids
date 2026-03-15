/**
 * Core type definitions for AI Recommendations feature
 */

export enum RiskLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum AgeRange {
  INFANT = '0-1',
  TODDLER = '2-3',
  PRESCHOOL = '4-6',
  SCHOOL_AGE = '7+'
}

export enum Language {
  JAPANESE = 'ja',
  ENGLISH = 'en'
}

export interface GeographicUnit {
  country: string;
  stateOrPrefecture: string;
  countyOrWard?: string;
  jisCode?: string; // Japanese JIS code
  fipsCode?: string; // US FIPS code
}

export interface OutbreakData {
  diseaseId: string;
  diseaseName: string;
  diseaseNameLocal?: string;
  severity: number; // 1-10 scale
  severityTrend?: 'increasing' | 'stable' | 'decreasing';
  geographicUnit: GeographicUnit;
  affectedAgeRanges: AgeRange[];
  reportedCases: number;
  casesPerCapita?: number;
  symptoms?: string[];
  transmissionMode?: 'airborne' | 'contact' | 'foodborne' | 'vector';
  reportedAt?: Date;
  timestamp: Date;
  dataSource?: string;
}

export interface ChildProfile {
  id?: string;
  name?: string; // Never transmitted
  dateOfBirth?: Date; // Never transmitted
  exactAge?: number; // Never transmitted
  ageRange: AgeRange;
  location: GeographicUnit;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ActionItem {
  id: string;
  text: string;
  category: 'hygiene' | 'monitoring' | 'attendance' | 'nutrition' | 'other';
  priority: number; // 1-5, 1 being highest
}

export interface Recommendation {
  id: string;
  summary: string;
  actionItems: ActionItem[];
  riskLevel: RiskLevel;
  diseaseNames: string[];
  generatedAt: Date;
  outbreakDataTimestamp: Date;
  source: 'nova-lite' | 'nova-micro' | 'fallback';
  modelLatencyMs?: number;
  childAgeRange: AgeRange;
  geographicArea: string;
  language: Language;
  requiresMedicalClearance?: boolean;
}

export interface RiskAnalysisResult {
  riskLevel: RiskLevel;
  relevantOutbreaks: OutbreakData[];
  primaryDiseases: string[];
  riskFactors: string[];
}
