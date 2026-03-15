/**
 * Unit Tests for SafetyValidator
 * 
 * **Validates: Requirements 13.8, 13.9, 3.4, 3.5**
 * 
 * Tests safety validation logic:
 * - Medical diagnosis phrase detection
 * - Alarmist language detection
 * - Temperature threshold validation
 * - Age-appropriate guidance validation
 */

const SafetyValidator = require('../lib/safety-validator');

describe('SafetyValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SafetyValidator();
  });

  describe('validateNoDiagnosisPhrases', () => {
    it('should pass when no diagnosis phrases present', () => {
      const text = 'RSVの流行が報告されています。手洗いを徹底してください。';
      expect(validator.validateNoDiagnosisPhrases(text)).toBe(true);
    });

    it('should fail when Japanese diagnosis phrase detected', () => {
      const text = 'お子様はRSVの疑いがあります。';
      expect(validator.validateNoDiagnosisPhrases(text)).toBe(false);
    });

    it('should fail when English diagnosis phrase detected', () => {
      const text = 'Your child is suspected of having RSV.';
      expect(validator.validateNoDiagnosisPhrases(text)).toBe(false);
    });

    it('should fail when "diagnosed with" phrase detected', () => {
      const text = 'Your child has been diagnosed with influenza.';
      expect(validator.validateNoDiagnosisPhrases(text)).toBe(false);
    });

    it('should fail when "has disease" phrase detected', () => {
      const text = 'Your child has respiratory disease.';
      expect(validator.validateNoDiagnosisPhrases(text)).toBe(false);
    });

    it('should fail when "お子様は...です" phrase detected', () => {
      const text = 'お子様はインフルエンザです。';
      expect(validator.validateNoDiagnosisPhrases(text)).toBe(false);
    });
  });

  describe('validateNoAlarmistLanguage', () => {
    it('should pass when no alarmist language present', () => {
      const text = 'RSVの流行が報告されています。手洗いを徹底してください。';
      expect(validator.validateNoAlarmistLanguage(text)).toBe(true);
    });

    it('should fail when Japanese alarmist word "危険" detected', () => {
      const text = '危険な状況です。';
      expect(validator.validateNoAlarmistLanguage(text)).toBe(false);
    });

    it('should fail when Japanese alarmist word "緊急" detected', () => {
      const text = '緊急の対応が必要です。';
      expect(validator.validateNoAlarmistLanguage(text)).toBe(false);
    });

    it('should fail when English alarmist word "dangerous" detected', () => {
      const text = 'This is a dangerous situation.';
      expect(validator.validateNoAlarmistLanguage(text)).toBe(false);
    });

    it('should fail when English alarmist word "emergency" detected', () => {
      const text = 'This is an emergency.';
      expect(validator.validateNoAlarmistLanguage(text)).toBe(false);
    });

    it('should fail when English alarmist word "crisis" detected', () => {
      const text = 'We are facing a health crisis.';
      expect(validator.validateNoAlarmistLanguage(text)).toBe(false);
    });

    it('should be case-insensitive for alarmist words', () => {
      expect(validator.validateNoAlarmistLanguage('DANGEROUS situation')).toBe(false);
      expect(validator.validateNoAlarmistLanguage('Emergency alert')).toBe(false);
    });
  });

  describe('validateTemperatureThresholds', () => {
    it('should pass when valid Celsius temperature present', () => {
      const text = '37.5°Cを超える場合は登園を見合わせてください。';
      expect(validator.validateTemperatureThresholds(text)).toBe(true);
    });

    it('should pass when valid Fahrenheit temperature present', () => {
      const text = 'Stay home if temperature is above 99.5°F.';
      expect(validator.validateTemperatureThresholds(text)).toBe(true);
    });

    it('should fail when Celsius temperature too low', () => {
      const text = '体温が35.0°C以下の場合';
      expect(validator.validateTemperatureThresholds(text)).toBe(false);
    });

    it('should fail when Celsius temperature too high', () => {
      const text = '体温が43.0°Cを超える場合';
      expect(validator.validateTemperatureThresholds(text)).toBe(false);
    });

    it('should fail when Fahrenheit temperature too low', () => {
      const text = 'Temperature below 95.0°F';
      expect(validator.validateTemperatureThresholds(text)).toBe(false);
    });

    it('should fail when Fahrenheit temperature too high', () => {
      const text = 'Temperature above 108.0°F';
      expect(validator.validateTemperatureThresholds(text)).toBe(false);
    });

    it('should handle temperature without degree symbol', () => {
      const text = '37.5Cを超える場合';
      expect(validator.validateTemperatureThresholds(text)).toBe(true);
    });

    it('should handle decimal temperatures', () => {
      const text = '37.8°Cまたは99.5°F';
      expect(validator.validateTemperatureThresholds(text)).toBe(true);
    });

    it('should warn for non-standard Japanese threshold but still pass', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      // Use 38.5°C which is > 0.5 difference from 37.5°C
      const text = '38.5°Cを超える場合は登園を見合わせてください。';
      expect(validator.validateTemperatureThresholds(text)).toBe(true);
      // Warning should be triggered because text contains "登園" and temp is 38.5 (not 37.5)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Non-standard Japanese fever threshold')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('validateAgeAppropriateness', () => {
    it('should pass for infant when no inappropriate guidance present', () => {
      const text = '保護者が手洗いを徹底してください。';
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(true);
    });

    it('should fail for infant when "うがいをし" detected', () => {
      const text = 'うがいをしてください。';
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(false);
    });

    it('should fail for infant when "手洗いをし" detected', () => {
      const text = '手洗いをしてください。';
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(false);
    });

    it('should fail for infant when "gargle" detected', () => {
      const text = 'Gargle with warm water.';
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(false);
    });

    it('should fail for infant when "wash your hands" detected', () => {
      const text = 'Wash your hands frequently.';
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(false);
    });

    it('should pass for toddler with handwashing instruction', () => {
      const text = '手洗いをしてください。';
      const childProfile = { ageRange: '2-3' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(true);
    });

    it('should pass for preschool with gargling instruction', () => {
      const text = 'うがいをしてください。';
      const childProfile = { ageRange: '4-6' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(true);
    });

    it('should pass for school-age with all instructions', () => {
      const text = 'Wash your hands and gargle with warm water.';
      const childProfile = { ageRange: '7+' };
      expect(validator.validateAgeAppropriateness(text, childProfile)).toBe(true);
    });
  });

  describe('validateSafety - Integration', () => {
    it('should pass for safe recommendation', () => {
      const recommendation = {
        summary: 'RSVの流行が報告されています。予防措置を講じてください。',
        actionItems: [
          '朝の検温を実施し、37.5°C以上の場合は登園を見合わせる',
          '保護者が手洗いを徹底する',
          '十分な睡眠と栄養を確保する'
        ]
      };
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateSafety(recommendation, childProfile)).toBe(true);
    });

    it('should fail when diagnosis phrase present', () => {
      const recommendation = {
        summary: 'お子様はRSVの疑いがあります。',
        actionItems: ['医療機関を受診してください']
      };
      expect(validator.validateSafety(recommendation)).toBe(false);
    });

    it('should fail when alarmist language present', () => {
      const recommendation = {
        summary: '危険な状況です。緊急の対応が必要です。',
        actionItems: ['すぐに病院へ行ってください']
      };
      expect(validator.validateSafety(recommendation)).toBe(false);
    });

    it('should fail when invalid temperature threshold present', () => {
      const recommendation = {
        summary: 'RSVの流行が報告されています。',
        actionItems: ['体温が43.0°Cを超える場合は病院へ']
      };
      expect(validator.validateSafety(recommendation)).toBe(false);
    });

    it('should fail when age-inappropriate guidance for infant', () => {
      const recommendation = {
        summary: 'RSVの流行が報告されています。',
        actionItems: ['うがいをしてください', '手洗いをしてください']
      };
      const childProfile = { ageRange: '0-1' };
      expect(validator.validateSafety(recommendation, childProfile)).toBe(false);
    });

    it('should pass when child profile not provided', () => {
      const recommendation = {
        summary: 'RSVの流行が報告されています。',
        actionItems: ['手洗いをしてください']
      };
      // No child profile - age validation skipped
      expect(validator.validateSafety(recommendation)).toBe(true);
    });

    it('should validate all checks in order', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Multiple violations - should fail on first one (diagnosis)
      const recommendation = {
        summary: 'お子様はRSVの疑いがあります。危険な状況です。',
        actionItems: ['体温が43.0°Cを超える場合は病院へ']
      };
      
      expect(validator.validateSafety(recommendation)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Medical diagnosis phrase detected'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty recommendation', () => {
      const recommendation = {
        summary: '',
        actionItems: []
      };
      expect(validator.validateSafety(recommendation)).toBe(true);
    });

    it('should handle recommendation with only summary', () => {
      const recommendation = {
        summary: 'RSVの流行が報告されています。',
        actionItems: []
      };
      expect(validator.validateSafety(recommendation)).toBe(true);
    });

    it('should handle recommendation with only action items', () => {
      const recommendation = {
        summary: '',
        actionItems: ['手洗いを徹底する', '十分な睡眠を確保する']
      };
      expect(validator.validateSafety(recommendation)).toBe(true);
    });

    it('should handle multiple temperature values', () => {
      const text = '37.5°Cまたは99.5°Fを超える場合は登園を見合わせてください。';
      expect(validator.validateTemperatureThresholds(text)).toBe(true);
    });

    it('should handle mixed language content', () => {
      const recommendation = {
        summary: 'RSV outbreak reported. 手洗いを徹底してください。',
        actionItems: ['Check temperature', '体調を確認する']
      };
      expect(validator.validateSafety(recommendation)).toBe(true);
    });
  });
});
