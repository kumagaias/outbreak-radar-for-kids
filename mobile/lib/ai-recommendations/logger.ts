/**
 * Logging utility for AI Recommendations feature
 * 
 * Requirements:
 * - Support log levels (ERROR, WARN, INFO, DEBUG)
 * - Sanitize PII before logging
 * - Log service failures, cache operations, performance metrics
 */

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: {
    riskLevel?: string;
    ageRange?: string;
    latencyMs?: number;
    errorCode?: string;
    [key: string]: any;
  };
}

/**
 * PII patterns to sanitize from logs
 */
const PII_PATTERNS = [
  // Email addresses (must come before other patterns to avoid partial matches)
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  // Phone numbers (various formats)
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
  { pattern: /\b\d{3}[-.]?\d{4}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
  // Postal codes (Japan) - must come before dates
  { pattern: /\b\d{3}-\d{4}\b/g, replacement: '[POSTAL_CODE]' },
  // Dates of birth (various formats)
  { pattern: /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, replacement: '[DATE]' },
  { pattern: /\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, replacement: '[DATE]' },
  // Addresses (street numbers) - must come before names
  { pattern: /\b\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi, replacement: '[ADDRESS]' },
  // Exact ages (when followed by age indicators)
  { pattern: /\b\d+\s*(years old)\b/gi, replacement: '[AGE]' },
  { pattern: /\d+歳/g, replacement: '[AGE]' },
  { pattern: /\d+才/g, replacement: '[AGE]' },
  // Names (simple pattern - matches capitalized words) - must come last
  { pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, replacement: '[NAME]' }
];

/**
 * Sanitize text to remove PII before logging
 */
export function sanitizeForLogging(text: string): string {
  let sanitized = text;
  
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}

/**
 * Sanitize metadata object to remove PII
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  // Allowed metadata keys (whitelist approach)
  const allowedKeys = [
    'riskLevel',
    'ageRange',
    'latencyMs',
    'errorCode',
    'cacheHit',
    'source',
    'model',
    'language',
    'stateOrPrefecture',
    'country'
  ];
  
  for (const [key, value] of Object.entries(metadata)) {
    if (allowedKeys.includes(key)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Logger class for structured logging
 */
class Logger {
  private minLevel: LogLevel = LogLevel.INFO;
  
  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
  
  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentIndex = levels.indexOf(this.minLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex <= currentIndex;
  }
  
  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    component: string,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      component,
      message: sanitizeForLogging(message),
      metadata: metadata ? sanitizeMetadata(metadata) : undefined
    };
  }
  
  /**
   * Output log entry to console
   */
  private output(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const metadataStr = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    const logMessage = `[${timestamp}] ${entry.level} [${entry.component}] ${entry.message}${metadataStr}`;
    
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
    }
  }
  
  /**
   * Log an error message
   */
  error(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const entry = this.createLogEntry(LogLevel.ERROR, component, message, metadata);
      this.output(entry);
    }
  }
  
  /**
   * Log a warning message
   */
  warn(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const entry = this.createLogEntry(LogLevel.WARN, component, message, metadata);
      this.output(entry);
    }
  }
  
  /**
   * Log an info message
   */
  info(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const entry = this.createLogEntry(LogLevel.INFO, component, message, metadata);
      this.output(entry);
    }
  }
  
  /**
   * Log a debug message
   */
  debug(component: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const entry = this.createLogEntry(LogLevel.DEBUG, component, message, metadata);
      this.output(entry);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
