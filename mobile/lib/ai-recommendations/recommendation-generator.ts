/**
 * Recommendation Generator Component
 * 
 * Produces actionable guidance based on risk analysis, using Nova AI or fallback templates.
 * 
 * Key responsibilities:
 * - Model selection (Nova Micro for LOW/MEDIUM, Nova Lite for complex HIGH)
 * - Data anonymization (age range only, prefecture/state only)
 * - Disease name localization (English -> Japanese/English based on user language)
 * - Safety validation (no medical diagnosis phrases)
 * - Fallback on timeout/error
 * - Output validation (3-5 action items)
 * - Source tracking (nova-lite, nova-micro, fallback)
 */

import {
  RiskLevel,
  AgeRange,
  Language,
  OutbreakData,
  ChildProfile,
  Recommendation,
  ActionItem
} from './types';
import { NovaService, NovaModel } from './nova-service';
import {
  getFallbackRecommendation,
  checkMedicalClearanceRequired
} from './fallback-templates';
import { generateSystemPrompt } from './system-prompts';
import { NovaTimeoutError, NovaServiceError } from './errors';
import { SafetyValidator } from '../../src/safety-validator';
import { mapDiseaseName, requiresMedicalClearance } from './disease-name-mapper';

/**
 * Generate a simple unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Recommendation Generator
 */
export class RecommendationGenerator {
  private novaService: NovaService;
  private safetyValidator: SafetyValidator;

  constructor(novaService: NovaService) {
    this.novaService = novaService;
    this.safetyValidator = new SafetyValidator();
  }

  /**
   * Select Nova model based on risk level and outbreak complexity
   */
  private selectNovaModel(
    riskLevel: RiskLevel,
    outbreakData: OutbreakData[]
  ): NovaModel {
    // Cost optimization: Use Nova Micro up to MEDIUM risk
    // Use Nova Lite only for HIGH risk with complex conditions (multiple concurrent diseases)

    if (riskLevel === RiskLevel.LOW) {
      return NovaModel.MICRO; // Cost-efficient for simple guidance
    }

    if (riskLevel === RiskLevel.MEDIUM) {
      return NovaModel.MICRO; // Micro provides sufficient quality for medium risk
    }

    // For HIGH risk, evaluate complexity
    if (riskLevel === RiskLevel.HIGH) {
      const highSeverityCount = outbreakData.filter(o => o.severity >= 7).length;

      // Use Lite only when multiple high-severity diseases are concurrent
      if (highSeverityCount >= 2) {
        return NovaModel.LITE; // Higher quality for complex scenarios
      }

      return NovaModel.MICRO; // Single high-risk disease can be handled by Micro
    }

    return NovaModel.MICRO; // Default
  }

  /**
   * Anonymize data for Nova service (age range + prefecture/state only)
   */
  private anonymizeForNovaService(
    childProfile: ChildProfile,
    outbreakData: OutbreakData[]
  ): {
    ageRange: AgeRange;
    geographicArea: string;
    diseaseNames: string[];
  } {
    // Only transmit prefecture/state level
    const geographicArea = `${childProfile.location.stateOrPrefecture}, ${childProfile.location.country}`;

    // Extract disease names (use localized names if available)
    const diseaseNames = outbreakData.map(o => o.diseaseNameLocal || o.diseaseName);

    return {
      ageRange: childProfile.ageRange,
      geographicArea,
      diseaseNames
    };
  }

  /**
   * Validate output structure (3-5 action items)
   */
  private validateOutput(output: { summary: string; actionItems: string[] }): boolean {
    if (!output.summary || typeof output.summary !== 'string') {
      return false;
    }

    if (!Array.isArray(output.actionItems)) {
      return false;
    }

    // Must have 3-5 action items
    if (output.actionItems.length < 3 || output.actionItems.length > 5) {
      return false;
    }

    // All action items must be non-empty strings
    if (output.actionItems.some(item => typeof item !== 'string' || item.trim() === '')) {
      return false;
    }

    return true;
  }

  /**
   * Convert action item strings to ActionItem objects
   */
  private convertToActionItems(actionItemStrings: string[]): ActionItem[] {
    return actionItemStrings.map((text, index) => ({
      id: generateId(),
      text,
      category: this.categorizeActionItem(text),
      priority: index + 1 // Priority based on order
    }));
  }

  /**
   * Categorize action item based on content
   */
  private categorizeActionItem(text: string): ActionItem['category'] {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes('手洗い') ||
      lowerText.includes('handwash') ||
      lowerText.includes('消毒') ||
      lowerText.includes('sanitiz')
    ) {
      return 'hygiene';
    }

    if (
      lowerText.includes('検温') ||
      lowerText.includes('temperature') ||
      lowerText.includes('症状') ||
      lowerText.includes('symptom') ||
      lowerText.includes('観察') ||
      lowerText.includes('monitor')
    ) {
      return 'monitoring';
    }

    if (
      lowerText.includes('登園') ||
      lowerText.includes('attendance') ||
      lowerText.includes('daycare') ||
      lowerText.includes('保育園')
    ) {
      return 'attendance';
    }

    if (
      lowerText.includes('睡眠') ||
      lowerText.includes('sleep') ||
      lowerText.includes('栄養') ||
      lowerText.includes('nutrition')
    ) {
      return 'nutrition';
    }

    return 'other';
  }

  /**
   * Generate offline mode recommendation (cache stale + network error)
   * 
   * Use Case: User opens app in subway/poor network area during morning routine
   * Scenario: Cache is stale (>7 days) AND network error prevents Nova call
   * 
   * Strategy: Display Risk_Analyzer result + minimal essential actions
   * Rationale: Parent needs "at least the current risk level" to make decisions
   */
  generateOfflineModeRecommendation(
    riskLevel: RiskLevel,
    childProfile: ChildProfile,
    language: Language
  ): Recommendation {
    const isJapanese = language === Language.JAPANESE;

    // Minimal essential actions based on risk level only
    const essentialActions: { [key in RiskLevel]: string[] } = {
      [RiskLevel.HIGH]: isJapanese
        ? [
            '朝の検温を実施する（37.5℃以上は登園を見合わせる）',
            '咳、鼻水、下痢などの症状を確認する',
            '手洗いとアルコール消毒を徹底する'
          ]
        : [
            'Check temperature in the morning (stay home if above 99.5°F)',
            'Watch for symptoms like cough, runny nose, or diarrhea',
            'Practice thorough handwashing and use hand sanitizer'
          ],
      [RiskLevel.MEDIUM]: isJapanese
        ? ['登園前に体調を確認する', '手洗いを丁寧に行う']
        : [
            'Check your child\'s condition before daycare',
            'Practice thorough handwashing'
          ],
      [RiskLevel.LOW]: isJapanese
        ? ['日常的な手洗いを継続する', '規則正しい生活リズムを維持する']
        : [
            'Continue routine handwashing practices',
            'Maintain regular sleep and meal schedules'
          ]
    };

    const riskLevelText: { [key in RiskLevel]: string } = {
      [RiskLevel.HIGH]: isJapanese ? '高' : 'high',
      [RiskLevel.MEDIUM]: isJapanese ? '中' : 'medium',
      [RiskLevel.LOW]: isJapanese ? '低' : 'low'
    };

    const summary = isJapanese
      ? `現在のリスクレベル: ${riskLevelText[riskLevel]}。ネットワーク接続が回復次第、詳細な推奨事項を表示します。`
      : `Current risk level: ${riskLevelText[riskLevel]}. Detailed recommendations will be displayed when network connection is restored.`;

    return {
      id: generateId(),
      summary,
      actionItems: this.convertToActionItems(essentialActions[riskLevel]),
      riskLevel,
      diseaseNames: [],
      generatedAt: new Date(),
      outbreakDataTimestamp: new Date(),
      source: 'fallback', // Mark as fallback to indicate offline mode
      childAgeRange: childProfile.ageRange,
      geographicArea: `${childProfile.location.stateOrPrefecture}, ${childProfile.location.country}`,
      language
    };
  }

  /**
   * Enrich outbreak data with localized disease names
   */
  private enrichOutbreakDataWithLocalizedNames(
    outbreakData: OutbreakData[],
    language: Language
  ): OutbreakData[] {
    return outbreakData.map(outbreak => ({
      ...outbreak,
      diseaseNameLocal: mapDiseaseName(outbreak.diseaseName, language)
    }));
  }

  /**
   * Generate recommendation using Nova or fallback
   */
  async generateRecommendation(
    riskLevel: RiskLevel,
    outbreakData: OutbreakData[],
    childProfile: ChildProfile,
    language: Language
  ): Promise<Recommendation> {
    // Enrich outbreak data with localized names
    const enrichedOutbreakData = this.enrichOutbreakDataWithLocalizedNames(
      outbreakData,
      language
    );

    const startTime = Date.now();
    let source: 'nova-lite' | 'nova-micro' | 'fallback' = 'fallback';
    let modelLatencyMs: number | undefined;
    let summary: string;
    let actionItems: ActionItem[];

    try {
      // Anonymize data (use localized names for Nova)
      const anonymizedData = this.anonymizeForNovaService(childProfile, enrichedOutbreakData);

      // Select model
      const model = this.selectNovaModel(riskLevel, enrichedOutbreakData);
      source = model === NovaModel.LITE ? 'nova-lite' : 'nova-micro';

      // Generate system prompt
      const systemPrompt = generateSystemPrompt({
        ageRange: anonymizedData.ageRange,
        geographicArea: anonymizedData.geographicArea,
        diseaseNames: anonymizedData.diseaseNames,
        riskLevel,
        language
      });

      // Call Nova service
      const novaResponse = await this.novaService.callNova(
        model,
        systemPrompt,
        '' // User input is empty, all context in system prompt
      );

      modelLatencyMs = novaResponse.latencyMs;

      // Validate output structure
      if (!this.validateOutput(novaResponse)) {
        throw new Error('Invalid Nova output structure');
      }

      // Safety validation with age range
      const safetyResult = this.safetyValidator.validateSafety(
        novaResponse,
        childProfile.ageRange
      );
      if (!safetyResult.isValid) {
        throw new Error(`Safety validation failed: ${safetyResult.reason}`);
      }

      summary = novaResponse.summary;
      actionItems = this.convertToActionItems(novaResponse.actionItems);
    } catch (error) {
      // Fallback on any error
      console.warn('Nova service failed, using fallback:', error);
      source = 'fallback';

      const fallback = getFallbackRecommendation(
        riskLevel,
        language,
        enrichedOutbreakData.map(o => o.diseaseNameLocal || o.diseaseName),
        `${childProfile.location.stateOrPrefecture}, ${childProfile.location.country}`
      );

      summary = fallback.summary;
      actionItems = this.convertToActionItems(fallback.actionItems);
    }

    // Check if disease requires medical clearance certificate (Japan only)
    const requiresMedicalClearanceFlag =
      language === Language.JAPANESE
        ? enrichedOutbreakData.some(o => requiresMedicalClearance(o.diseaseName))
        : undefined;

    // Get outbreak data timestamp (most recent)
    const outbreakDataTimestamp =
      enrichedOutbreakData.length > 0
        ? new Date(Math.max(...enrichedOutbreakData.map(o => o.timestamp.getTime())))
        : new Date();

    return {
      id: generateId(),
      summary,
      actionItems,
      riskLevel,
      diseaseNames: outbreakData.map(o => o.diseaseName),
      generatedAt: new Date(),
      outbreakDataTimestamp,
      source,
      modelLatencyMs,
      childAgeRange: childProfile.ageRange,
      geographicArea: `${childProfile.location.stateOrPrefecture}, ${childProfile.location.country}`,
      language,
      requiresMedicalClearance
    };
  }
}
