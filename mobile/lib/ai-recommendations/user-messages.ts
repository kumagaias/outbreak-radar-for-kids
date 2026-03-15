/**
 * User-facing error messages for AI Recommendations feature
 * 
 * Requirements:
 * - Non-alarmist language (no "failed", "error", "broken")
 * - Bilingual support (Japanese and English)
 * - Informative and calm tone
 */

export interface UserMessage {
  ja: string;
  en: string;
}

export const USER_ERROR_MESSAGES = {
  GENERAL_ERROR: {
    ja: "現在、推奨事項を生成しています。しばらくお待ちください。",
    en: "Generating recommendations. Please wait a moment."
  },
  STALE_DATA: {
    ja: "表示されている情報は{hours}時間前のものです。",
    en: "This information is {hours} hours old."
  },
  NO_OUTBREAK_DATA: {
    ja: "現在、お住まいの地域の感染症情報を取得できません。一般的な予防措置を継続してください。",
    en: "Unable to retrieve outbreak data for your area. Continue general preventive measures."
  }
} as const;

/**
 * Format a user message with placeholders
 */
export function formatUserMessage(
  message: UserMessage,
  language: 'ja' | 'en',
  params?: Record<string, string | number>
): string {
  let text = message[language];
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      text = text.replace(`{${key}}`, String(value));
    });
  }
  
  return text;
}
