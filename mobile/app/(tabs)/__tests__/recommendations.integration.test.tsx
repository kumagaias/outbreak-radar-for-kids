/**
 * Integration Test for Full Recommendation Flow
 * 
 * Tests the complete recommendation flow:
 * - App startup → background generation → cache population
 * - User opens screen → cache hit → display within 3 seconds
 * - Cache miss → generate new → display within 5 seconds
 * - Nova timeout → fallback → display recommendation
 * - Feedback submission → save to AsyncStorage
 * 
 * **Validates: Requirements 9.2, 9.3, 7.1, 12.3**
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecommendationScreen from '../recommendations';
import {
  RiskAnalyzer,
  RecommendationGenerator,
  CacheManager,
  NovaService,
  FeedbackCollector,
  RiskLevel,
  AgeRange,
  Language,
  type Recommendation,
  type OutbreakData,
  type ChildProfile,
} from '@/lib/ai-recommendations';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/profile-context', () => ({
  useProfile: () => ({
    profile: {
      country: 'JP',
      area: 'Tokyo',
      children: [{ id: '1', name: 'Test Child', ageGroup: '2-3' }],
    },
    isLoading: false,
  }),
}));
jest.mock('@/lib/mock-data', () => ({
  getOutbreakDataForArea: () => [
    {
      diseaseId: 'rsv',
      diseaseName: 'RSV',
      level: 'high',
      cases: 150,
      country: 'JP',
      area: 'Tokyo',
    },
  ],
}));

describe('RecommendationScreen Integration Tests', () => {
  let riskAnalyzer: RiskAnalyzer;
  let cacheManager: CacheManager;
  let recommendationGenerator: RecommendationGenerator;
  let feedbackCollector: FeedbackCollector;

  const mockChildProfile: ChildProfile = {
    ageRange: AgeRange.TODDLER,
    location: {
      country: 'JP',
      stateOrPrefecture: 'Tokyo',
    },
  };

  const mockOutbreakData: OutbreakData[] = [
    {
      diseaseId: 'rsv',
      diseaseName: 'RSV',
      severity: 8,
      geographicUnit: {
        country: 'JP',
        stateOrPrefecture: 'Tokyo',
      },
      affectedAgeRanges: [AgeRange.INFANT, AgeRange.TODDLER],
      reportedCases: 150,
      timestamp: new Date(),
    },
  ];

  const mockRecommendation: Recommendation = {
    id: 'test-rec-1',
    summary: 'RSVの流行が東京で報告されています。',
    actionItems: [
      {
        id: 'action-1',
        text: '朝の検温を実施する',
        category: 'monitoring',
        priority: 1,
      },
      {
        id: 'action-2',
        text: '手洗いを徹底する',
        category: 'hygiene',
        priority: 2,
      },
      {
        id: 'action-3',
        text: '症状がないか確認する',
        category: 'monitoring',
        priority: 3,
      },
    ],
    riskLevel: RiskLevel.HIGH,
    diseaseNames: ['RSV'],
    generatedAt: new Date(),
    outbreakDataTimestamp: new Date(),
    source: 'nova-micro',
    childAgeRange: AgeRange.TODDLER,
    geographicArea: 'Tokyo, JP',
    language: Language.JAPANESE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    riskAnalyzer = new RiskAnalyzer();
    cacheManager = new CacheManager();
    const novaService = new NovaService();
    recommendationGenerator = new RecommendationGenerator(novaService);
    feedbackCollector = new FeedbackCollector();
  });

  /**
   * Test: App startup → background generation → cache population
   * **Validates: Requirement 9.2**
   */
  it('should generate and cache recommendation on app startup', async () => {
    // Simulate app startup
    const startTime = Date.now();

    // Generate recommendation
    const riskLevel = await riskAnalyzer.calculateRiskLevel(
      mockOutbreakData,
      mockChildProfile
    );
    expect(riskLevel).toBe(RiskLevel.HIGH);

    const recommendation = await recommendationGenerator.generateRecommendation(
      riskLevel,
      mockOutbreakData,
      mockChildProfile,
      Language.JAPANESE
    );

    // Cache the recommendation
    await cacheManager.setCachedRecommendation(
      mockChildProfile,
      recommendation,
      new Date()
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify cache was populated
    expect(AsyncStorage.setItem).toHaveBeenCalled();

    // Verify it completed in reasonable time (should be fast in test environment)
    expect(duration).toBeLessThan(10000); // 10 seconds max for test environment
  });

  /**
   * Test: User opens screen → cache hit → display within 3 seconds
   * **Validates: Requirement 9.2, 4.5**
   */
  it('should display cached recommendation within 3 seconds', async () => {
    // Pre-populate cache
    const cachedData = {
      recommendation: mockRecommendation,
      timestamp: Date.now(),
      outbreakDataTimestamp: Date.now(),
      childAgeRange: AgeRange.TODDLER,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

    const startTime = Date.now();

    // Get cached recommendation
    const cached = await cacheManager.getCachedRecommendation(mockChildProfile);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify cache hit
    expect(cached).not.toBeNull();
    expect(cached?.recommendation.id).toBe(mockRecommendation.id);
    expect(cached?.isStale).toBe(false);

    // Verify it completed within 3 seconds
    expect(duration).toBeLessThan(3000);
  });

  /**
   * Test: Cache miss → generate new → display within 5 seconds
   * **Validates: Requirement 9.3, 2.7**
   */
  it('should generate new recommendation within 5 seconds on cache miss', async () => {
    // No cache
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const startTime = Date.now();

    // Calculate risk level
    const riskLevel = await riskAnalyzer.calculateRiskLevel(
      mockOutbreakData,
      mockChildProfile
    );

    // Generate recommendation (with fallback, should be fast)
    const recommendation = await recommendationGenerator.generateRecommendation(
      riskLevel,
      mockOutbreakData,
      mockChildProfile,
      Language.JAPANESE
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Verify recommendation was generated
    expect(recommendation).toBeDefined();
    expect(recommendation.riskLevel).toBe(RiskLevel.HIGH);
    expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
    expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);

    // Verify it completed within 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  /**
   * Test: Nova timeout → fallback → display recommendation
   * **Validates: Requirement 7.1, 7.2, 7.5**
   */
  it('should use fallback on Nova timeout', async () => {
    // Mock Nova service to timeout
    const novaService = new NovaService();
    jest.spyOn(novaService, 'callNova').mockRejectedValue(new Error('Timeout'));

    const generator = new RecommendationGenerator(novaService);

    // Generate recommendation (should fallback)
    const recommendation = await generator.generateRecommendation(
      RiskLevel.HIGH,
      mockOutbreakData,
      mockChildProfile,
      Language.JAPANESE
    );

    // Verify fallback was used
    expect(recommendation.source).toBe('fallback');
    expect(recommendation.riskLevel).toBe(RiskLevel.HIGH);
    expect(recommendation.actionItems.length).toBeGreaterThanOrEqual(3);
    expect(recommendation.actionItems.length).toBeLessThanOrEqual(5);

    // Verify no error was thrown
    expect(recommendation).toBeDefined();
  });

  /**
   * Test: Feedback submission → save to AsyncStorage
   * **Validates: Requirement 12.3**
   */
  it('should save feedback to AsyncStorage', async () => {
    // Submit feedback
    await feedbackCollector.saveFeedback(
      mockRecommendation.id,
      true,
      RiskLevel.HIGH,
      AgeRange.TODDLER,
      Language.JAPANESE,
      'nova-micro'
    );

    // Verify feedback was saved
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'feedback_data',
      expect.any(String)
    );

    // Verify feedback data structure
    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const feedbackList = JSON.parse(savedData);
    expect(feedbackList).toHaveLength(1);
    expect(feedbackList[0].recommendationId).toBe(mockRecommendation.id);
    expect(feedbackList[0].helpful).toBe(true);
    expect(feedbackList[0].riskLevel).toBe(RiskLevel.HIGH);
  });

  /**
   * Test: Cache invalidation on data change
   * **Validates: Requirement 9.6**
   */
  it('should invalidate cache when outbreak data changes', async () => {
    // Pre-populate cache with old timestamp
    const oldTimestamp = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    const cachedData = {
      recommendation: mockRecommendation,
      timestamp: Date.now(),
      outbreakDataTimestamp: oldTimestamp.getTime(),
      childAgeRange: AgeRange.TODDLER,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

    // Check if outbreak data changed
    const newTimestamp = new Date();
    const hasChanged = await cacheManager.checkOutbreakDataChange(
      mockChildProfile,
      newTimestamp
    );

    // Verify cache was invalidated
    expect(hasChanged).toBe(true);
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  /**
   * Test: Progressive loading (risk level first, then full recommendation)
   * **Validates: Requirement 11.5**
   */
  it('should display risk level before full recommendation', async () => {
    const startTime = Date.now();

    // Step 1: Calculate risk level (fast)
    const riskLevel = await riskAnalyzer.calculateRiskLevel(
      mockOutbreakData,
      mockChildProfile
    );
    const riskLevelTime = Date.now() - startTime;

    // Verify risk level is available quickly
    expect(riskLevel).toBe(RiskLevel.HIGH);
    expect(riskLevelTime).toBeLessThan(3000);

    // Step 2: Generate full recommendation (may take longer)
    const recommendation = await recommendationGenerator.generateRecommendation(
      riskLevel,
      mockOutbreakData,
      mockChildProfile,
      Language.JAPANESE
    );
    const fullTime = Date.now() - startTime;

    // Verify full recommendation is available
    expect(recommendation).toBeDefined();
    expect(fullTime).toBeLessThan(5000);
  });
});
