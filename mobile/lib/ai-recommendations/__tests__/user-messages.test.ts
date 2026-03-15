/**
 * Unit tests for user-facing error messages
 * 
 * Requirements:
 * - Test GENERAL_ERROR message is non-alarmist (no "failed", "error", "broken")
 * - Test STALE_DATA message is informative and calm
 * - Test NO_OUTBREAK_DATA message is helpful and non-alarming
 * - Test Japanese and English versions exist for all messages
 */

import { USER_ERROR_MESSAGES, formatUserMessage } from '../user-messages';

describe('User Error Messages', () => {
  describe('GENERAL_ERROR', () => {
    it('should have both Japanese and English versions', () => {
      expect(USER_ERROR_MESSAGES.GENERAL_ERROR.ja).toBeDefined();
      expect(USER_ERROR_MESSAGES.GENERAL_ERROR.en).toBeDefined();
      expect(USER_ERROR_MESSAGES.GENERAL_ERROR.ja.length).toBeGreaterThan(0);
      expect(USER_ERROR_MESSAGES.GENERAL_ERROR.en.length).toBeGreaterThan(0);
    });

    it('should not contain alarmist terms in English', () => {
      const message = USER_ERROR_MESSAGES.GENERAL_ERROR.en.toLowerCase();
      expect(message).not.toMatch(/failed/);
      expect(message).not.toMatch(/error/);
      expect(message).not.toMatch(/broken/);
      expect(message).not.toMatch(/unavailable/);
      expect(message).not.toMatch(/problem/);
    });

    it('should not contain alarmist terms in Japanese', () => {
      const message = USER_ERROR_MESSAGES.GENERAL_ERROR.ja;
      expect(message).not.toMatch(/失敗/);
      expect(message).not.toMatch(/エラー/);
      expect(message).not.toMatch(/問題/);
      expect(message).not.toMatch(/利用できません/);
    });

    it('should be informative and calm', () => {
      expect(USER_ERROR_MESSAGES.GENERAL_ERROR.en).toContain('Generating');
      expect(USER_ERROR_MESSAGES.GENERAL_ERROR.ja).toContain('生成');
    });
  });

  describe('STALE_DATA', () => {
    it('should have both Japanese and English versions', () => {
      expect(USER_ERROR_MESSAGES.STALE_DATA.ja).toBeDefined();
      expect(USER_ERROR_MESSAGES.STALE_DATA.en).toBeDefined();
      expect(USER_ERROR_MESSAGES.STALE_DATA.ja.length).toBeGreaterThan(0);
      expect(USER_ERROR_MESSAGES.STALE_DATA.en.length).toBeGreaterThan(0);
    });

    it('should not contain alarmist terms in English', () => {
      const message = USER_ERROR_MESSAGES.STALE_DATA.en.toLowerCase();
      expect(message).not.toMatch(/failed/);
      expect(message).not.toMatch(/error/);
      expect(message).not.toMatch(/broken/);
      expect(message).not.toMatch(/expired/);
    });

    it('should not contain alarmist terms in Japanese', () => {
      const message = USER_ERROR_MESSAGES.STALE_DATA.ja;
      expect(message).not.toMatch(/失敗/);
      expect(message).not.toMatch(/エラー/);
      expect(message).not.toMatch(/期限切れ/);
    });

    it('should be informative with placeholder for hours', () => {
      expect(USER_ERROR_MESSAGES.STALE_DATA.en).toContain('{hours}');
      expect(USER_ERROR_MESSAGES.STALE_DATA.ja).toContain('{hours}');
    });
  });

  describe('NO_OUTBREAK_DATA', () => {
    it('should have both Japanese and English versions', () => {
      expect(USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.ja).toBeDefined();
      expect(USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.en).toBeDefined();
      expect(USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.ja.length).toBeGreaterThan(0);
      expect(USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.en.length).toBeGreaterThan(0);
    });

    it('should not contain alarmist terms in English', () => {
      const message = USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.en.toLowerCase();
      expect(message).not.toMatch(/failed/);
      expect(message).not.toMatch(/error/);
      expect(message).not.toMatch(/broken/);
      expect(message).not.toMatch(/critical/);
    });

    it('should not contain alarmist terms in Japanese', () => {
      const message = USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.ja;
      expect(message).not.toMatch(/失敗/);
      expect(message).not.toMatch(/エラー/);
      expect(message).not.toMatch(/重大/);
    });

    it('should be helpful and provide guidance', () => {
      expect(USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.en).toContain('preventive measures');
      expect(USER_ERROR_MESSAGES.NO_OUTBREAK_DATA.ja).toContain('予防措置');
    });
  });

  describe('formatUserMessage', () => {
    it('should format message in Japanese', () => {
      const formatted = formatUserMessage(
        USER_ERROR_MESSAGES.STALE_DATA,
        'ja',
        { hours: '24' }
      );
      expect(formatted).toContain('24');
      expect(formatted).not.toContain('{hours}');
    });

    it('should format message in English', () => {
      const formatted = formatUserMessage(
        USER_ERROR_MESSAGES.STALE_DATA,
        'en',
        { hours: '24' }
      );
      expect(formatted).toContain('24');
      expect(formatted).not.toContain('{hours}');
    });

    it('should return message without params if none provided', () => {
      const formatted = formatUserMessage(
        USER_ERROR_MESSAGES.GENERAL_ERROR,
        'en'
      );
      expect(formatted).toBe(USER_ERROR_MESSAGES.GENERAL_ERROR.en);
    });

    it('should handle multiple placeholders', () => {
      const testMessage = {
        ja: '{name}さん、{count}件の通知があります',
        en: '{name}, you have {count} notifications'
      };
      
      const formatted = formatUserMessage(testMessage, 'en', {
        name: 'User',
        count: '5'
      });
      
      expect(formatted).toBe('User, you have 5 notifications');
    });
  });
});
