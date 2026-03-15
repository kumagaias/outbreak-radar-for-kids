/**
 * AI Recommendations Module
 * 
 * This module provides AI-powered infectious disease risk assessments
 * and personalized recommendations for parents of young children.
 * 
 * Re-exports all components from the ai-recommendations directory.
 */

// Export all types and components from the new implementation
export * from './ai-recommendations/types';
export * from './ai-recommendations/errors';
export * from './ai-recommendations/risk-analyzer';
export * from './ai-recommendations/nova-service';
export * from './ai-recommendations/recommendation-generator';
export * from './ai-recommendations/cache-manager';
export * from './ai-recommendations/app-initializer';
export * from './ai-recommendations/feedback-collector';
export * from './ai-recommendations/user-messages';
export * from './ai-recommendations/logger';
export * from './ai-recommendations/model-selector';
export * from './ai-recommendations/cost-tracker';
