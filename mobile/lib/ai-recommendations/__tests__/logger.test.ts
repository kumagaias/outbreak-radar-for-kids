/**
 * Unit tests for logging utility
 * 
 * Requirements:
 * - Test log function with levels (ERROR, WARN, INFO, DEBUG)
 * - Test sanitization removes PII before logging
 * - Test logging of service failures, cache operations, performance metrics
 */

import { logger, LogLevel, sanitizeForLogging, sanitizeMetadata } from '../logger';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    logger.setMinLevel(LogLevel.DEBUG); // Enable all logs for testing
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('Log Levels', () => {
    it('should log ERROR messages', () => {
      logger.error('TestComponent', 'Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('ERROR');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('TestComponent');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Test error message');
    });

    it('should log WARN messages', () => {
      logger.warn('TestComponent', 'Test warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('WARN');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('TestComponent');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Test warning message');
    });

    it('should log INFO messages', () => {
      logger.info('TestComponent', 'Test info message');
      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleInfoSpy.mock.calls[0][0]).toContain('INFO');
      expect(consoleInfoSpy.mock.calls[0][0]).toContain('TestComponent');
      expect(consoleInfoSpy.mock.calls[0][0]).toContain('Test info message');
    });

    it('should log DEBUG messages', () => {
      logger.debug('TestComponent', 'Test debug message');
      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleDebugSpy.mock.calls[0][0]).toContain('DEBUG');
      expect(consoleDebugSpy.mock.calls[0][0]).toContain('TestComponent');
      expect(consoleDebugSpy.mock.calls[0][0]).toContain('Test debug message');
    });
  });

  describe('Log Level Filtering', () => {
    it('should not log DEBUG when min level is INFO', () => {
      logger.setMinLevel(LogLevel.INFO);
      logger.debug('TestComponent', 'Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log ERROR when min level is INFO', () => {
      logger.setMinLevel(LogLevel.INFO);
      logger.error('TestComponent', 'Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not log INFO when min level is ERROR', () => {
      logger.setMinLevel(LogLevel.ERROR);
      logger.info('TestComponent', 'Info message');
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metadata Logging', () => {
    it('should log metadata with message', () => {
      logger.info('TestComponent', 'Test message', {
        riskLevel: 'high',
        latencyMs: 150
      });
      
      expect(consoleInfoSpy).toHaveBeenCalled();
      const logOutput = consoleInfoSpy.mock.calls[0][0];
      expect(logOutput).toContain('riskLevel');
      expect(logOutput).toContain('high');
      expect(logOutput).toContain('latencyMs');
      expect(logOutput).toContain('150');
    });

    it('should log service failures with error code', () => {
      logger.error('NovaService', 'Service timeout', {
        errorCode: 'TIMEOUT',
        latencyMs: 5000
      });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Service timeout');
      expect(logOutput).toContain('TIMEOUT');
    });

    it('should log cache operations', () => {
      logger.info('CacheManager', 'Cache hit', {
        cacheHit: true,
        ageRange: '2-3'
      });
      
      expect(consoleInfoSpy).toHaveBeenCalled();
      const logOutput = consoleInfoSpy.mock.calls[0][0];
      expect(logOutput).toContain('Cache hit');
      expect(logOutput).toContain('cacheHit');
    });

    it('should log performance metrics', () => {
      logger.debug('RiskAnalyzer', 'Risk calculation completed', {
        latencyMs: 250,
        riskLevel: 'medium'
      });
      
      expect(consoleDebugSpy).toHaveBeenCalled();
      const logOutput = consoleDebugSpy.mock.calls[0][0];
      expect(logOutput).toContain('latencyMs');
      expect(logOutput).toContain('250');
    });
  });

  describe('PII Sanitization', () => {
    it('should sanitize email addresses', () => {
      const text = 'User email is john.doe@example.com';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('john.doe@example.com');
      expect(sanitized).toContain('[EMAIL]');
    });

    it('should sanitize phone numbers', () => {
      const text = 'Contact: 123-456-7890';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('123-456-7890');
      expect(sanitized).toContain('[PHONE]');
    });

    it('should sanitize Japanese postal codes', () => {
      const text = 'Address: 123-4567';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('123-4567');
      expect(sanitized).toContain('[POSTAL_CODE]');
    });

    it('should sanitize dates', () => {
      const text = 'Date of birth: 2020-05-15';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('2020-05-15');
      expect(sanitized).toContain('[DATE]');
    });

    it('should sanitize exact ages', () => {
      const text = 'Child is 3 years old';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('3 years old');
      expect(sanitized).toContain('[AGE]');
    });

    it('should sanitize Japanese age notation', () => {
      const text = '子供は3歳です';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('3歳');
      expect(sanitized).toContain('[AGE]');
    });

    it('should sanitize street addresses', () => {
      const text = 'Lives at 123 Main Street';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).not.toContain('123 Main Street');
      expect(sanitized).toContain('[ADDRESS]');
    });

    it('should preserve non-PII information', () => {
      const text = 'Risk level: high, Age range: 2-3';
      const sanitized = sanitizeForLogging(text);
      expect(sanitized).toContain('Risk level: high');
      expect(sanitized).toContain('Age range: 2-3');
    });
  });

  describe('Metadata Sanitization', () => {
    it('should only include allowed metadata keys', () => {
      const metadata = {
        riskLevel: 'high',
        ageRange: '2-3',
        userName: 'John Doe', // Should be filtered out
        email: 'john@example.com' // Should be filtered out
      };
      
      const sanitized = sanitizeMetadata(metadata);
      expect(sanitized.riskLevel).toBe('high');
      expect(sanitized.ageRange).toBe('2-3');
      expect(sanitized.userName).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
    });

    it('should sanitize string values in allowed keys', () => {
      const metadata = {
        riskLevel: 'high',
        stateOrPrefecture: 'Tokyo with email john@example.com'
      };
      
      const sanitized = sanitizeMetadata(metadata);
      expect(sanitized.stateOrPrefecture).toContain('[EMAIL]');
      expect(sanitized.stateOrPrefecture).not.toContain('john@example.com');
    });

    it('should preserve numeric values', () => {
      const metadata = {
        latencyMs: 150,
        errorCode: 'TIMEOUT'
      };
      
      const sanitized = sanitizeMetadata(metadata);
      expect(sanitized.latencyMs).toBe(150);
      expect(sanitized.errorCode).toBe('TIMEOUT');
    });
  });

  describe('Log Message Sanitization', () => {
    it('should automatically sanitize PII in log messages', () => {
      logger.info('TestComponent', 'User john.doe@example.com accessed system');
      
      expect(consoleInfoSpy).toHaveBeenCalled();
      const logOutput = consoleInfoSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('john.doe@example.com');
      expect(logOutput).toContain('[EMAIL]');
    });

    it('should sanitize PII in error messages', () => {
      logger.error('TestComponent', 'Failed for user at 123 Main Street', {
        errorCode: 'ACCESS_DENIED'
      });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).not.toContain('123 Main Street');
      expect(logOutput).toContain('[ADDRESS]');
    });
  });
});
