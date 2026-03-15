/**
 * Unit tests for Recommendation Generator
 * 
 * Tests specific scenarios:
 * - Model selection (LOW → MICRO, MEDIUM/HIGH → LITE)
 * - Fallback on Nova timeout
 * - Fallback on Nova error
 * - Output validation (3-5 action items)
 * - Japanese output includes です・ます
 * - SafetyValidator detects medical diagnosis phrases
 */

import { RecommendationGenerator } from '../recommendation-generator';
import { SafetyValidator } from '../../../src/safety-validator';
import { NovaService, NovaModel } from '../nova-service';
import {
  RiskLevel,
  AgeRange,
  Language,
  OutbreakData,
  ChildProfile
} from '../types';
import { NovaTimeoutError, NovaServiceError } from '../errors';

describe('RecommendationGenerator', () => {
  let generator: RecommendationGenerator;
  let mockNovaService: jest.Mocked<NovaService>;

  const testChildProfile: ChildProfile = {
    ageRange: AgeRange.TODDLER,
    location: {
      country: 'JP',
      stateOrPrefecture: 'Tokyo',
      countyOrWard: 'Nerima'
    }
  };

  const testOutbreakData: OutbreakData[] = [
    {
      diseaseId: 'rsv-001',
      diseaseName: 'RSV',
      severity: 8,
      geographicUnit: {
        country: 'JP',
        stateOrPrefecture: 'Tokyo'
      },
      affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER],
      reportedCases: 150,
      timestamp: new Date()
    }
  ];

  beforeEach(() => {
    mockNovaService = {
      callNova: jest.fn()
    } as any;

    generator = new RecommendationGenerator(mockNovaService);
  });

  describe('Model Selection', () => {
    it('should use Nova Micro for LOW risk', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Low risk summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.LOW,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(mockNovaService.callNova).toHaveBeenCalledWith(
        NovaModel.MICRO,
        expect.any(String),
        ''
      );
      expect(recommendation.source).toBe('nova-micro');
    });

    it('should use Nova Micro for MEDIUM risk', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Medium risk summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(mockNovaService.callNova).toHaveBeenCalledWith(
        NovaModel.MICRO,
        expect.any(String),
        ''
      );
      expect(recommendation.source).toBe('nova-micro');
    });

    it('should use Nova Micro for HIGH risk with single disease', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'High risk summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.HIGH,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(mockNovaService.callNova).toHaveBeenCalledWith(
        NovaModel.MICRO,
        expect.any(String),
        ''
      );
      expect(recommendation.source).toBe('nova-micro');
    });

    it('should use Nova Lite for HIGH risk with multiple high-severity diseases', async () => {
      const multipleOutbreaks: OutbreakData[] = [
        {
          diseaseId: 'rsv-001',
          diseaseName: 'RSV',
          severity: 8,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.INFANT],
          reportedCases: 150,
          timestamp: new Date()
        },
        {
          diseaseId: 'flu-001',
          diseaseName: 'Influenza',
          severity: 7,
          geographicUnit: { country: 'JP', stateOrPrefecture: 'Tokyo' },
          affectedAgeRanges: [AgeRange.TODDLER],
          reportedCases: 200,
          timestamp: new Date()
        }
      ];

      mockNovaService.callNova.mockResolvedValue({
        summary: 'Complex high risk summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.LITE,
        latencyMs: 1500
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.HIGH,
        multipleOutbreaks,
        testChildProfile,
        Language.ENGLISH
      );

      expect(mockNovaService.callNova).toHaveBeenCalledWith(
        NovaModel.LITE,
        expect.any(String),
        ''
      );
      expect(recommendation.source).toBe('nova-lite');
    });
  });

  describe('Fallback Handling', () => {
    it('should use fallback on Nova timeout', async () => {
      mockNovaService.callNova.mockRejectedValue(
        new NovaTimeoutError('Timeout after 5s')
      );

      const recommendation = await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(recommendation.source).toBe('fallback');
      expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
      expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);
    });

    it('should use fallback on Nova error', async () => {
      mockNovaService.callNova.mockRejectedValue(
        new NovaServiceError('API error')
      );

      const recommendation = await generator.generateRecommendation(
        RiskLevel.HIGH,
        testOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );

      expect(recommendation.source).toBe('fallback');
      expect(recommendation.summary).toBeTruthy();
      expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
    });

    it('should use fallback on invalid output structure', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Valid summary',
        actionItems: ['Only one action'], // Invalid: needs 3-5 items
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.LOW,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(recommendation.source).toBe('fallback');
      expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
    });

    it('should use fallback on safety validation failure', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Your child has RSV', // Medical diagnosis phrase
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(recommendation.source).toBe('fallback');
    });
  });

  describe('Output Validation', () => {
    it('should validate 3-5 action items', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Valid summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3', 'Action 4'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(recommendation.actionItems.length).toBe(4);
      expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
      expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);
    });

    it('should convert action item strings to ActionItem objects', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Valid summary',
        actionItems: [
          'Check temperature in the morning',
          'Practice thorough handwashing',
          'Monitor for symptoms'
        ],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      expect(recommendation.actionItems[0]).toHaveProperty('id');
      expect(recommendation.actionItems[0]).toHaveProperty('text');
      expect(recommendation.actionItems[0]).toHaveProperty('category');
      expect(recommendation.actionItems[0]).toHaveProperty('priority');
    });
  });

  describe('Japanese Output', () => {
    it('should include です・ます in Japanese recommendations', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: '現在の流行状況を考慮し、お子様の健康管理に注意が必要です。',
        actionItems: [
          '朝の検温を実施してください',
          '手洗いを徹底してください',
          '体調の変化を観察してください'
        ],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const recommendation = await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.JAPANESE
      );

      // Check for polite form markers
      const fullText =
        recommendation.summary +
        ' ' +
        recommendation.actionItems.map(item => item.text).join(' ');

      expect(
        fullText.includes('です') ||
          fullText.includes('ます') ||
          fullText.includes('ください')
      ).toBe(true);
    });
  });

  describe('Data Anonymization', () => {
    it('should not transmit ward/county information', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        testChildProfile,
        Language.ENGLISH
      );

      const systemPrompt = mockNovaService.callNova.mock.calls[0][1];

      // Should include prefecture/state
      expect(systemPrompt).toContain('Tokyo');

      // Should NOT include ward
      expect(systemPrompt).not.toContain('Nerima');
    });

    it('should only transmit age range, not exact age', async () => {
      mockNovaService.callNova.mockResolvedValue({
        summary: 'Summary',
        actionItems: ['Action 1', 'Action 2', 'Action 3'],
        model: NovaModel.MICRO,
        latencyMs: 1000
      });

      const profileWithExactAge: ChildProfile = {
        ...testChildProfile,
        exactAge: 2.5,
        name: 'Test Child',
        dateOfBirth: new Date('2021-06-15')
      };

      await generator.generateRecommendation(
        RiskLevel.MEDIUM,
        testOutbreakData,
        profileWithExactAge,
        Language.ENGLISH
      );

      const systemPrompt = mockNovaService.callNova.mock.calls[0][1];

      // Should include age range
      expect(systemPrompt).toContain('2-3');

      // Should NOT include exact age, name, or date of birth
      expect(systemPrompt).not.toContain('2.5');
      expect(systemPrompt).not.toContain('Test Child');
      expect(systemPrompt).not.toContain('2021');
    });
  });
});

describe('SafetyValidator', () => {
  let validator: SafetyValidator;

  beforeEach(() => {
    validator = new SafetyValidator();
  });

  describe('Medical Diagnosis Detection', () => {
    it('should detect "疑いがあります" pattern', () => {
      const recommendation = {
        summary: 'RSVの疑いがあります',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "suspected of" pattern', () => {
      const recommendation = {
        summary: 'Your child is suspected of having RSV',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "diagnosed with" pattern', () => {
      const recommendation = {
        summary: 'Child diagnosed with influenza',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "has [disease]" pattern', () => {
      const recommendation = {
        summary: 'Your child has RSV disease',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "お子様は.*です" pattern', () => {
      const recommendation = {
        summary: 'お子様はRSVに感染しています',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "your child has" pattern', () => {
      const recommendation = {
        summary: 'Your child has symptoms of RSV',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "感染しています" pattern', () => {
      const recommendation = {
        summary: 'RSVに感染しています',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });

    it('should detect "infected with" pattern', () => {
      const recommendation = {
        summary: 'Child may be infected with RSV',
        actionItems: ['Action 1', 'Action 2', 'Action 3']
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(false);
    });
  });

  describe('Safe Recommendations', () => {
    it('should allow safe recommendations without diagnosis phrases', () => {
      const recommendation = {
        summary: 'RSV outbreaks have been reported in Tokyo. Monitor your child\'s health closely.',
        actionItems: [
          'Check temperature in the morning',
          'Practice thorough handwashing',
          'Monitor for symptoms'
        ]
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(true);
    });

    it('should allow Japanese safe recommendations', () => {
      const recommendation = {
        summary: 'RSVの流行が東京で報告されています。お子様の健康状態を注意深く観察してください。',
        actionItems: [
          '朝の検温を実施してください',
          '手洗いを徹底してください',
          '症状がないか確認してください'
        ]
      };

      expect(validator.validateSafety(recommendation).isValid).toBe(true);
    });
  });
});
