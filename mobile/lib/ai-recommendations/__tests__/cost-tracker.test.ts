/**
 * Unit tests for CostTracker
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CostTracker } from '../cost-tracker';
import { NovaModel } from '../nova-service';

describe('CostTracker', () => {
  let costTracker: CostTracker;

  beforeEach(() => {
    costTracker = new CostTracker();
    jest.clearAllMocks();
  });

  describe('trackCall', () => {
    it('should track Nova Lite call and update cost', async () => {
      let storedData: string | null = null;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(storedData));
      (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
        storedData = value;
        return Promise.resolve();
      });

      await costTracker.trackCall(NovaModel.LITE);

      const metrics = await costTracker.getMetrics();
      expect(metrics.novaLiteCalls).toBe(1);
      expect(metrics.novaMicroCalls).toBe(0);
      expect(metrics.estimatedCost).toBeGreaterThan(0);
    });

    it('should track Nova Micro call and update cost', async () => {
      let storedData: string | null = null;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(storedData));
      (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
        storedData = value;
        return Promise.resolve();
      });

      await costTracker.trackCall(NovaModel.MICRO);

      const metrics = await costTracker.getMetrics();
      expect(metrics.novaLiteCalls).toBe(0);
      expect(metrics.novaMicroCalls).toBe(1);
      expect(metrics.estimatedCost).toBeGreaterThan(0);
    });

    it('should accumulate multiple calls', async () => {
      let storedData: string | null = null;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(storedData));
      (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
        storedData = value;
        return Promise.resolve();
      });

      await costTracker.trackCall(NovaModel.LITE);
      await costTracker.trackCall(NovaModel.MICRO);
      await costTracker.trackCall(NovaModel.LITE);

      const metrics = await costTracker.getMetrics();
      expect(metrics.novaLiteCalls).toBe(2);
      expect(metrics.novaMicroCalls).toBe(1);
    });
  });

  describe('trackFallback', () => {
    it('should track fallback usage', async () => {
      let storedData: string | null = null;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(storedData));
      (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
        storedData = value;
        return Promise.resolve();
      });

      await costTracker.trackFallback();

      const metrics = await costTracker.getMetrics();
      expect(metrics.fallbackUsage).toBe(1);
    });

    it('should not affect cost when tracking fallback', async () => {
      let storedData: string | null = null;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(storedData));
      (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
        storedData = value;
        return Promise.resolve();
      });

      await costTracker.trackFallback();

      const metrics = await costTracker.getMetrics();
      expect(metrics.estimatedCost).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return default metrics when no data exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const metrics = await costTracker.getMetrics();

      expect(metrics.novaLiteCalls).toBe(0);
      expect(metrics.novaMicroCalls).toBe(0);
      expect(metrics.fallbackUsage).toBe(0);
      expect(metrics.estimatedCost).toBe(0);
      expect(metrics.lastUpdated).toBeInstanceOf(Date);
    });

    it('should load existing metrics from storage', async () => {
      const storedMetrics = {
        novaLiteCalls: 5,
        novaMicroCalls: 10,
        fallbackUsage: 2,
        estimatedCost: 0.009,
        lastUpdated: new Date().toISOString()
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedMetrics));

      const metrics = await costTracker.getMetrics();

      expect(metrics.novaLiteCalls).toBe(5);
      expect(metrics.novaMicroCalls).toBe(10);
      expect(metrics.fallbackUsage).toBe(2);
      expect(metrics.estimatedCost).toBe(0.009);
    });

    it('should handle corrupted storage data gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const metrics = await costTracker.getMetrics();

      expect(metrics.novaLiteCalls).toBe(0);
      expect(metrics.novaMicroCalls).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', async () => {
      let storedData: string | null = null;
      (AsyncStorage.getItem as jest.Mock).mockImplementation(() => Promise.resolve(storedData));
      (AsyncStorage.setItem as jest.Mock).mockImplementation((key, value) => {
        storedData = value;
        return Promise.resolve();
      });

      // Track some calls
      await costTracker.trackCall(NovaModel.LITE);
      await costTracker.trackCall(NovaModel.MICRO);

      // Reset
      await costTracker.resetMetrics();

      const metrics = await costTracker.getMetrics();
      expect(metrics.novaLiteCalls).toBe(0);
      expect(metrics.novaMicroCalls).toBe(0);
      expect(metrics.fallbackUsage).toBe(0);
      expect(metrics.estimatedCost).toBe(0);
    });
  });

  describe('estimateMonthlyCost', () => {
    it('should return 0 for invalid days elapsed', async () => {
      const monthlyCost = await costTracker.estimateMonthlyCost(0);
      expect(monthlyCost).toBe(0);
    });

    it('should calculate monthly cost based on daily average', async () => {
      const storedMetrics = {
        novaLiteCalls: 10,
        novaMicroCalls: 20,
        fallbackUsage: 0,
        estimatedCost: 0.018, // 10 * 0.0015 + 20 * 0.00015
        lastUpdated: new Date().toISOString()
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(storedMetrics));

      // 10 days elapsed, daily average = 0.018 / 10 = 0.0018
      // Monthly estimate = 0.0018 * 30 = 0.054
      const monthlyCost = await costTracker.estimateMonthlyCost(10);
      expect(monthlyCost).toBeCloseTo(0.054, 3);
    });
  });
});
