/**
 * Error classes for AI Recommendations feature
 */

export class NovaTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NovaTimeoutError';
  }
}

export class NovaServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NovaServiceError';
  }
}

export class PIIDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PIIDetectedError';
  }
}

export class LocationTooGranularError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationTooGranularError';
  }
}

export class OutbreakAPITimeout extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutbreakAPITimeout';
  }
}
