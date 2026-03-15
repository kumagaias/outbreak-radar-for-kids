/**
 * PromptManager - Retrieves and caches system prompts from AWS Systems Manager Parameter Store
 * Implements prompt version logging for correlation with user feedback
 */

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

class PromptManager {
  constructor(region = process.env.AWS_REGION || 'ap-northeast-1') {
    // Use AWS_REGION (Lambda region) for Parameter Store, not BEDROCK_REGION
    // Parameter Store parameters are stored in the same region as Lambda
    this.client = new SSMClient({ region });
    this.cache = new Map(); // In-memory cache for prompts
    this.promptJaPath = process.env.PROMPT_JA_PATH || '/prompts/v1/ja';
    this.promptEnPath = process.env.PROMPT_EN_PATH || '/prompts/v1/en';
  }

  /**
   * Retrieves prompt from Parameter Store with caching
   * @param {string} language - Language code (ja, en)
   * @returns {Promise<Object>} Prompt object with content and version
   */
  async getPrompt(language) {
    const parameterPath = language === 'ja' ? this.promptJaPath : this.promptEnPath;
    
    // Check cache first
    if (this.cache.has(parameterPath)) {
      const cached = this.cache.get(parameterPath);
      console.log(`Using cached prompt for ${language}, version: ${cached.version}`);
      return cached;
    }
    
    try {
      // Retrieve from Parameter Store
      const command = new GetParameterCommand({
        Name: parameterPath,
        WithDecryption: false // Prompts are not encrypted
      });
      
      const response = await this.client.send(command);
      
      if (!response.Parameter || !response.Parameter.Value) {
        throw new Error(`Prompt not found at ${parameterPath}`);
      }
      
      // Extract version from parameter metadata
      const version = response.Parameter.Version || 1;
      const content = response.Parameter.Value;
      
      // Cache the prompt
      const promptObject = {
        content,
        version,
        path: parameterPath,
        lastModified: response.Parameter.LastModifiedDate
      };
      
      this.cache.set(parameterPath, promptObject);
      
      console.log(`Retrieved prompt from Parameter Store: ${parameterPath}, version: ${version}`);
      
      return promptObject;
      
    } catch (error) {
      console.error(`Error retrieving prompt from Parameter Store: ${error.message}`);
      
      // Fallback to hardcoded prompt if Parameter Store fails
      console.warn('Falling back to hardcoded prompt');
      return this.getFallbackPrompt(language);
    }
  }

  /**
   * Builds complete system prompt with placeholders replaced
   * @param {string} language - Language code (ja, en)
   * @param {string} ageRange - Age range
   * @param {string} geographicArea - Geographic area
   * @param {Array<string>} diseaseNames - Disease names
   * @param {string} riskLevel - Risk level
   * @param {boolean} nearbyHotspot - Whether user is near a hotspot
   * @returns {Promise<Object>} Prompt object with content and version
   */
  async buildSystemPrompt(language, ageRange, geographicArea, diseaseNames, riskLevel, nearbyHotspot = false) {
    const promptObject = await this.getPrompt(language);
    
    // Extract area (first part before comma)
    const area = geographicArea.split(',')[0].trim();
    
    // Join disease names with appropriate separator
    const diseases = diseaseNames.join(language === 'ja' ? '、' : ', ');
    
    // Replace placeholders in prompt template (using single braces)
    let content = promptObject.content
      .replace(/\{ageRange\}/g, ageRange)
      .replace(/\{geographicArea\}/g, area)
      .replace(/\{diseaseNames\}/g, diseases)
      .replace(/\{riskLevel\}/g, riskLevel);
    
    // Enhance prompt when user is near a hotspot
    if (nearbyHotspot) {
      const vigilanceEnhancement = language === 'ja'
        ? '\n\n重要: ユーザーは感染症の流行地域の近くにいます。より慎重な観察と予防措置を強調してください。ただし、地域情報は都道府県レベルのみを使用し、より詳細な位置情報は含めないでください。'
        : '\n\nIMPORTANT: The user is near an outbreak hotspot. Emphasize heightened vigilance and preventive measures. However, maintain prefecture/state-level anonymity and do not include more granular location information.';
      
      content += vigilanceEnhancement;
    }
    
    return {
      content,
      version: promptObject.version,
      path: promptObject.path
    };
  }

  /**
   * Returns fallback hardcoded prompt when Parameter Store is unavailable
   * @param {string} language - Language code (ja, en)
   * @returns {Object} Prompt object with content and version
   */
  getFallbackPrompt(language) {
    const fallbackPrompts = {
      ja: `あなたは保護者に感染症に関するアドバイスを提供する、知識豊富で安心感のある保育アドバイザーです。

役割: 知識豊富だが安心感を与える保育専門家として振る舞ってください。

トーン要件:
- 落ち着いた、支援的な言葉を使用する
- 「危険」「緊急」「非常事態」などの警戒的な表現を避ける
- 恐怖ではなく、実行可能なステップに焦点を当てる
- 具体的で実用的であること
- 丁寧な形式(です・ます調)を使用する

言語要件:
- 日本語で回答する
- 丁寧な形式(です・ます調)を使用する

禁止事項:
- 医学的診断や治療の推奨
- 「お子様は[病気]です」のような表現
- 診断を示唆する表現: 「疑いがあります」「診断されました」
- 医療相談を避けるようなアドバイス

出力形式:
{
  "summary": "病名とリスクレベルに言及した2〜3文の概要",
  "actionItems": [
    "具体的な行動1",
    "具体的な行動2",
    "具体的な行動3"
  ]
}

コンテキスト:
- 子供の年齢範囲: {ageRange}
- 地域: {geographicArea}
- 現在の流行: {diseaseNames}
- リスクレベル: {riskLevel}

重要: 有効なJSONのみを返してください。マークダウンのコードブロック、説明、追加のテキストは不要です。JSONオブジェクトのみを返してください。`,
      
      en: `You are a helpful childcare advisor providing infectious disease guidance to parents.

ROLE: Act as a knowledgeable but reassuring childcare professional.

TONE REQUIREMENTS:
- Use calm, supportive language
- Avoid alarmist phrases like "dangerous", "urgent", "emergency"
- Focus on actionable steps rather than fear
- Be specific and practical
- Use declarative sentences

LANGUAGE REQUIREMENTS:
- Respond in English
- Use declarative sentences

PROHIBITED:
- Medical diagnosis or treatment recommendations
- Statements like "your child has [disease]"
- Phrases suggesting diagnosis: "suspected of", "diagnosed with"
- Advice to avoid medical consultation

OUTPUT FORMAT:
{
  "summary": "2-3 sentence overview mentioning disease names and risk level",
  "actionItems": [
    "Specific action 1",
    "Specific action 2",
    "Specific action 3"
  ]
}

CONTEXT:
- Child age range: {ageRange}
- Geographic area: {geographicArea}
- Current outbreaks: {diseaseNames}
- Risk level: {riskLevel}

CRITICAL: Return ONLY valid JSON. No markdown code blocks, no explanations, no additional text. Just the JSON object.`
    };
    
    return {
      content: fallbackPrompts[language] || fallbackPrompts.en,
      version: 'fallback',
      path: 'hardcoded'
    };
  }

  /**
   * Clears the prompt cache (useful for testing or forcing refresh)
   */
  clearCache() {
    this.cache.clear();
    console.log('Prompt cache cleared');
  }
}

module.exports = PromptManager;
