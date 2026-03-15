/**
 * Fallback Templates - Rule-based recommendations when Nova is unavailable
 * Templates match AI tone (non-alarmist, action-oriented)
 */

const FALLBACK_TEMPLATES = {
  HIGH_RISK_JAPANESE: {
    summary: '{diseaseNames}の流行が{area}で報告されています。お子様の健康状態を注意深く観察し、症状が見られる場合は登園を控えることをお勧めします。',
    actionItems: [
      '朝の検温を実施し、37.5℃以上または平熱より高い場合は登園を見合わせる',
      '咳、鼻水、下痢などの症状がないか確認する',
      '手洗いとアルコール消毒を徹底する',
      '保育園に現在の流行状況を確認する',
      '症状が見られる場合は、医療機関を受診し、必要に応じて登園許可証を取得する'
    ]
  },
  HIGH_RISK_ENGLISH: {
    summary: 'Outbreaks of {diseaseNames} have been reported in {area}. Monitor your child\'s health closely and consider keeping them home if symptoms appear.',
    actionItems: [
      'Check temperature in the morning; stay home if above 99.5°F or higher than normal',
      'Watch for symptoms like cough, runny nose, or diarrhea',
      'Practice thorough handwashing and use hand sanitizer',
      'Contact daycare to confirm current outbreak status',
      'If symptoms appear, consult a healthcare provider and obtain medical clearance if required'
    ]
  },
  MEDIUM_RISK_JAPANESE: {
    summary: '{diseaseNames}の感染が{area}で増加傾向にあります。予防措置を講じながら、通常通りの登園が可能です。',
    actionItems: [
      '登園前に体調を確認する',
      '手洗いを丁寧に行う',
      '十分な睡眠と栄養を確保する'
    ]
  },
  MEDIUM_RISK_ENGLISH: {
    summary: 'Cases of {diseaseNames} are increasing in {area}. Normal attendance is appropriate with preventive measures in place.',
    actionItems: [
      'Check your child\'s condition before daycare',
      'Practice thorough handwashing',
      'Ensure adequate sleep and nutrition'
    ]
  },
  LOW_RISK_JAPANESE: {
    summary: '現在、{area}では大きな感染症の流行は報告されていません。通常通りの登園で問題ありません。',
    actionItems: [
      '日常的な手洗いを継続する',
      '規則正しい生活リズムを維持する',
      '体調の変化があれば早めに対応する'
    ]
  },
  LOW_RISK_ENGLISH: {
    summary: 'No major disease outbreaks are currently reported in {area}. Normal attendance is appropriate.',
    actionItems: [
      'Continue routine handwashing practices',
      'Maintain regular sleep and meal schedules',
      'Monitor for any changes in health'
    ]
  }
};

/**
 * Generates fallback recommendation using rule-based templates
 * @param {string} riskLevel - Risk level (high, medium, low)
 * @param {string} language - Language (ja, en)
 * @param {Array<string>} diseaseNames - Array of disease names
 * @param {string} geographicArea - Geographic area
 * @returns {Object} Fallback recommendation
 */
function generateFallbackRecommendation(riskLevel, language, diseaseNames, geographicArea) {
  const templateKey = `${riskLevel.toUpperCase()}_RISK_${language === 'ja' ? 'JAPANESE' : 'ENGLISH'}`;
  const template = FALLBACK_TEMPLATES[templateKey];
  
  if (!template) {
    throw new Error(`No fallback template found for ${templateKey}`);
  }
  
  // Extract area name (remove country code)
  const area = geographicArea.split(',')[0].trim();
  
  // Format disease names
  const formattedDiseases = diseaseNames.length > 0 
    ? diseaseNames.join(language === 'ja' ? '、' : ', ')
    : (language === 'ja' ? '感染症' : 'infectious diseases');
  
  // Replace template variables
  const summary = template.summary
    .replace('{diseaseNames}', formattedDiseases)
    .replace('{area}', area);
  
  return {
    summary,
    actionItems: template.actionItems,
    riskLevel,
    diseaseNames,
    generatedAt: new Date().toISOString(),
    source: 'fallback'
  };
}

module.exports = {
  FALLBACK_TEMPLATES,
  generateFallbackRecommendation
};
