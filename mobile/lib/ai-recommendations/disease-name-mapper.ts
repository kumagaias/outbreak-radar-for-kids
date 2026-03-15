/**
 * Disease Name Mapper
 * Maps English disease names from CDC/NIID to localized names
 */

import { Language } from './types';

/**
 * Disease name mapping for localization
 */
const DISEASE_NAME_MAP: Record<string, { ja: string; en: string }> = {
  // Respiratory diseases
  'RSV': {
    ja: 'RSウイルス感染症',
    en: 'RSV'
  },
  'Respiratory Syncytial Virus': {
    ja: 'RSウイルス感染症',
    en: 'RSV'
  },
  'Influenza': {
    ja: 'インフルエンザ',
    en: 'Influenza'
  },
  'Flu': {
    ja: 'インフルエンザ',
    en: 'Influenza'
  },
  'COVID-19': {
    ja: '新型コロナウイルス感染症',
    en: 'COVID-19'
  },
  'SARS-CoV-2': {
    ja: '新型コロナウイルス感染症',
    en: 'COVID-19'
  },
  'Measles': {
    ja: '麻疹',
    en: 'Measles'
  },
  'Mpox': {
    ja: 'サル痘',
    en: 'Mpox'
  },
  'H5': {
    ja: 'H5型インフルエンザ',
    en: 'H5 Influenza'
  },
  'H5N1': {
    ja: 'H5N1型インフルエンザ',
    en: 'H5N1 Influenza'
  },
  
  // Gastrointestinal diseases
  'Norovirus': {
    ja: 'ノロウイルス',
    en: 'Norovirus'
  },
  'Hand-Foot-Mouth Disease': {
    ja: '手足口病',
    en: 'Hand-Foot-Mouth Disease'
  },
  'HFMD': {
    ja: '手足口病',
    en: 'Hand-Foot-Mouth Disease'
  },
  'Rotavirus': {
    ja: 'ロタウイルス',
    en: 'Rotavirus'
  },
  
  // Other diseases
  'Strep Throat': {
    ja: '溶連菌感染症',
    en: 'Strep Throat'
  },
  'Streptococcal Pharyngitis': {
    ja: '溶連菌感染症',
    en: 'Strep Throat'
  },
  'Chickenpox': {
    ja: '水痘',
    en: 'Chickenpox'
  },
  'Varicella': {
    ja: '水痘',
    en: 'Chickenpox'
  },
  'Mumps': {
    ja: '流行性耳下腺炎',
    en: 'Mumps'
  },
  'Rubella': {
    ja: '風疹',
    en: 'Rubella'
  },
  'Pertussis': {
    ja: '百日咳',
    en: 'Pertussis'
  },
  'Whooping Cough': {
    ja: '百日咳',
    en: 'Pertussis'
  }
};

/**
 * Map disease name to localized version
 */
export function mapDiseaseName(
  diseaseName: string,
  language: Language
): string {
  // Try exact match first
  const mapping = DISEASE_NAME_MAP[diseaseName];
  if (mapping) {
    return language === Language.JAPANESE ? mapping.ja : mapping.en;
  }

  // Try case-insensitive match
  const lowerName = diseaseName.toLowerCase();
  for (const [key, value] of Object.entries(DISEASE_NAME_MAP)) {
    if (key.toLowerCase() === lowerName) {
      return language === Language.JAPANESE ? value.ja : value.en;
    }
  }

  // Try partial match (for cases like "RSV Infection" -> "RSV")
  for (const [key, value] of Object.entries(DISEASE_NAME_MAP)) {
    if (lowerName.includes(key.toLowerCase())) {
      return language === Language.JAPANESE ? value.ja : value.en;
    }
  }

  // Return original name if no mapping found
  return diseaseName;
}

/**
 * Check if disease requires medical clearance certificate in Japan
 */
export function requiresMedicalClearance(diseaseName: string): boolean {
  const DISEASES_REQUIRING_CLEARANCE = [
    'インフルエンザ',
    'Influenza',
    'Flu',
    'RSウイルス感染症',
    'RSV',
    'Respiratory Syncytial Virus',
    '溶連菌感染症',
    'Strep Throat',
    'Streptococcal Pharyngitis',
    '水痘',
    'Chickenpox',
    'Varicella',
    '流行性耳下腺炎',
    'Mumps',
    '風疹',
    'Rubella',
    '麻疹',
    'Measles',
    '百日咳',
    'Pertussis',
    'Whooping Cough'
  ];

  return DISEASES_REQUIRING_CLEARANCE.some(
    disease => 
      diseaseName.toLowerCase().includes(disease.toLowerCase()) ||
      disease.toLowerCase().includes(diseaseName.toLowerCase())
  );
}
