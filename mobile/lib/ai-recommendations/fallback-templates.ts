/**
 * Fallback template system for when Nova service is unavailable
 * 
 * These templates provide rule-based recommendations that match AI tone:
 * - Non-alarmist language
 * - Action-oriented guidance
 * - Cultural sensitivity (Japanese 37.5°C threshold)
 */

import { RiskLevel, Language } from './types';

export interface FallbackTemplate {
  summary: string;
  actionItems: string[];
}

/**
 * Template variable substitution
 */
export interface TemplateVariables {
  diseaseNames: string;
  area: string;
}

/**
 * Fallback templates for all risk levels and languages
 */
export const FALLBACK_TEMPLATES: Record<
  RiskLevel,
  Record<Language, FallbackTemplate>
> = {
  [RiskLevel.HIGH]: {
    [Language.JAPANESE]: {
      summary: '{diseaseNames}の流行が{area}で報告されています。お子様の健康状態を注意深く観察し、症状が見られる場合は登園を控えることをお勧めします。',
      actionItems: [
        '朝の検温を実施し、37.5℃以上または平熱より高い場合は登園を見合わせる',
        '咳、鼻水、下痢などの症状がないか確認する',
        '手洗いとアルコール消毒を徹底する',
        '保育園に現在の流行状況を確認する',
        '症状が見られる場合は、医療機関を受診し、必要に応じて登園許可証を取得する'
      ]
    },
    [Language.ENGLISH]: {
      summary: 'Outbreaks of {diseaseNames} have been reported in {area}. Monitor your child\'s health closely and consider keeping them home if symptoms appear.',
      actionItems: [
        'Check temperature in the morning; stay home if above 99.5°F or higher than normal',
        'Watch for symptoms like cough, runny nose, or diarrhea',
        'Practice thorough handwashing and use hand sanitizer',
        'Contact daycare to confirm current outbreak status',
        'If symptoms appear, consult a healthcare provider and obtain medical clearance if required'
      ]
    }
  },
  [RiskLevel.MEDIUM]: {
    [Language.JAPANESE]: {
      summary: '{diseaseNames}の感染が{area}で増加傾向にあります。予防措置を講じながら、通常通りの登園が可能です。',
      actionItems: [
        '登園前に体調を確認する',
        '手洗いを丁寧に行う',
        '十分な睡眠と栄養を確保する'
      ]
    },
    [Language.ENGLISH]: {
      summary: 'Cases of {diseaseNames} are increasing in {area}. Normal attendance is appropriate with preventive measures in place.',
      actionItems: [
        'Check your child\'s condition before daycare',
        'Practice thorough handwashing',
        'Ensure adequate sleep and nutrition'
      ]
    }
  },
  [RiskLevel.LOW]: {
    [Language.JAPANESE]: {
      summary: '現在、{area}では大きな感染症の流行は報告されていません。通常通りの登園で問題ありません。',
      actionItems: [
        '日常的な手洗いを継続する',
        '規則正しい生活リズムを維持する',
        '体調の変化があれば早めに対応する'
      ]
    },
    [Language.ENGLISH]: {
      summary: 'No major disease outbreaks are currently reported in {area}. Normal attendance is appropriate.',
      actionItems: [
        'Continue routine handwashing practices',
        'Maintain regular sleep and meal schedules',
        'Monitor for any changes in health'
      ]
    }
  }
};

/**
 * Substitute template variables with actual values
 */
export function substituteTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  // Escape special regex characters in replacement strings
  // This prevents "$&" and other special chars from being interpreted as regex patterns
  const escapedDiseaseNames = variables.diseaseNames.replace(/\$/g, '$$$$');
  const escapedArea = variables.area.replace(/\$/g, '$$$$');
  
  return template
    .replace(/{diseaseNames}/g, escapedDiseaseNames)
    .replace(/{area}/g, escapedArea);
}

/**
 * Get fallback recommendation for given risk level and language
 */
export function getFallbackRecommendation(
  riskLevel: RiskLevel,
  language: Language,
  diseaseNames: string[],
  geographicArea: string
): { summary: string; actionItems: string[] } {
  const template = FALLBACK_TEMPLATES[riskLevel][language];
  
  // Format disease names based on language
  const formattedDiseaseNames = formatDiseaseNames(diseaseNames, language);
  
  // Substitute variables in summary
  const summary = substituteTemplateVariables(template.summary, {
    diseaseNames: formattedDiseaseNames,
    area: geographicArea
  });
  
  // Action items don't need variable substitution
  const actionItems = template.actionItems;
  
  return {
    summary,
    actionItems
  };
}

/**
 * Format disease names based on language
 */
function formatDiseaseNames(diseaseNames: string[], language: Language): string {
  if (diseaseNames.length === 0) {
    return language === Language.JAPANESE ? '感染症' : 'infectious diseases';
  }
  
  if (language === Language.JAPANESE) {
    // Japanese: join with 、
    return diseaseNames.join('、');
  } else {
    // English: join with commas and "and"
    if (diseaseNames.length === 1) {
      return diseaseNames[0];
    } else if (diseaseNames.length === 2) {
      return `${diseaseNames[0]} and ${diseaseNames[1]}`;
    } else {
      const lastDisease = diseaseNames[diseaseNames.length - 1];
      const otherDiseases = diseaseNames.slice(0, -1).join(', ');
      return `${otherDiseases}, and ${lastDisease}`;
    }
  }
}

/**
 * Diseases requiring medical clearance certificate (登園許可証) in Japan
 */
export const DISEASES_REQUIRING_CLEARANCE_JP = [
  'インフルエンザ',
  'RSウイルス感染症',
  '溶連菌感染症',
  '水痘',
  '流行性耳下腺炎',
  '風疹',
  '麻疹',
  '百日咳',
  'Influenza',
  'RSV',
  'Strep Throat',
  'Chickenpox',
  'Mumps',
  'Rubella',
  'Measles',
  'Whooping Cough'
];

/**
 * Check if any disease requires medical clearance certificate
 */
export function checkMedicalClearanceRequired(diseaseNames: string[]): boolean {
  return diseaseNames.some(name =>
    DISEASES_REQUIRING_CLEARANCE_JP.some(clearanceDisease =>
      name.toLowerCase().includes(clearanceDisease.toLowerCase())
    )
  );
}
