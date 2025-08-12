import { hasExceededCallLimit, getDailyLimit } from '../CallTimeService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock __DEV__ for consistent testing
const originalDev = (global as any).__DEV__;

describe('Call Limits Integration Tests', () => {
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = false; // Use production limits by default
  });

  afterAll(() => {
    (global as any).__DEV__ = originalDev;
  });

  describe('End-to-End Plan Detection and Limit Checking', () => {
    it('should correctly handle Google Play Store Communicate plan', async () => {
      // Mock no existing usage
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const planId = 'GPA.3392-8909-2570-57225..1';
      const planName = 'Communicate Plan';
      const productId = 'communicate_monthly';

      // Should detect as communicate plan with 30-minute limit
      const limit = await getDailyLimit(planId, planName, productId);
      expect(limit).toBe(30);

      // Should not exceed limit with no usage
      const hasExceeded = await hasExceededCallLimit('user-123', planId, planName, productId);
      expect(hasExceeded).toBe(false);
    });

    it('should correctly handle Free plan limits', async () => {
      // Mock no existing usage
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const planId = 'free';
      const planName = 'Free Plan';
      const productId = 'free';

      // Should detect as free plan with 3-minute limit
      const limit = await getDailyLimit(planId, planName, productId);
      expect(limit).toBe(3);

      // Should not exceed limit with no usage
      const hasExceeded = await hasExceededCallLimit('user-123', planId, planName, productId);
      expect(hasExceeded).toBe(false);
    });

    it('should correctly handle exceeding free plan limits', async () => {
      // Mock usage that exceeds free plan limit (3 minutes)
      const sessions = JSON.stringify([
        { startTime: Date.now() - 20000, endTime: Date.now() - 15000, durationMinutes: 2 },
        { startTime: Date.now() - 10000, endTime: Date.now() - 5000, durationMinutes: 2 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);

      const hasExceeded = await hasExceededCallLimit('user-123', 'free', 'Free Plan', 'free');
      expect(hasExceeded).toBe(true);
    });

    it('should correctly handle exceeding communicate plan limits', async () => {
      // Mock usage that exceeds communicate plan limit (30 minutes)
      const sessions = JSON.stringify([
        { startTime: Date.now() - 40000, endTime: Date.now() - 35000, durationMinutes: 20 },
        { startTime: Date.now() - 20000, endTime: Date.now() - 15000, durationMinutes: 15 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);

      const hasExceeded = await hasExceededCallLimit(
        'user-123', 
        'GPA.3392-8909-2570-57225..1', 
        'Communicate Plan', 
        'communicate_monthly'
      );
      expect(hasExceeded).toBe(true);
    });

    it('should handle plan detection priority correctly', async () => {
      // Test ID priority (communicate in ID should override non-communicate in name)
      expect(await getDailyLimit('communicate_test', 'free_plan')).toBe(30);
      
      // Test name priority (when ID doesn't match, name should be used)
      expect(await getDailyLimit('some_id', 'communicate_plan')).toBe(30);
      
      // Test productId priority (when ID and name don't match, productId should be used)
      expect(await getDailyLimit('some_id', 'some_name', 'communicate_yearly')).toBe(30);
    });

    it('should handle missing plan information gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      // Should default to free plan limits when plan info is missing
      const hasExceeded = await hasExceededCallLimit(
        'user-123', 
        undefined, 
        undefined, 
        undefined
      );
      expect(hasExceeded).toBe(false);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw error and should return false (fail safely)
      const hasExceeded = await hasExceededCallLimit('user-123', 'free');
      expect(hasExceeded).toBe(false);
    });
  });

  describe('Development vs Production Environment', () => {
    it('should use correct limits in production mode', async () => {
      (global as any).__DEV__ = false;
      
      expect(await getDailyLimit('free')).toBe(3);
      expect(await getDailyLimit('communicate_plan')).toBe(30);
    });

    it('should use correct limits in development mode', async () => {
      (global as any).__DEV__ = true;
      
      expect(await getDailyLimit('free')).toBe(120);
      expect(await getDailyLimit('communicate_plan')).toBe(480);
    });
  });

  describe('Real-world Scenarios', () => {
    beforeEach(() => {
      (global as any).__DEV__ = false; // Production mode
    });

    it('should handle typical free user journey', async () => {
      const userId = 'free-user-123';
      const planId = 'free';

      // Start with no usage - should be allowed
      mockAsyncStorage.getItem.mockResolvedValue(null);
      let hasExceeded = await hasExceededCallLimit(userId, planId);
      expect(hasExceeded).toBe(false);

      // After 2 minutes of usage - still allowed
      let sessions = JSON.stringify([
        { startTime: Date.now() - 120000, endTime: Date.now() - 60000, durationMinutes: 2 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      hasExceeded = await hasExceededCallLimit(userId, planId);
      expect(hasExceeded).toBe(false);

      // After 4 minutes of usage - should be blocked
      sessions = JSON.stringify([
        { startTime: Date.now() - 240000, endTime: Date.now() - 120000, durationMinutes: 2 },
        { startTime: Date.now() - 120000, endTime: Date.now() - 60000, durationMinutes: 2 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      hasExceeded = await hasExceededCallLimit(userId, planId);
      expect(hasExceeded).toBe(true);
    });

    it('should handle typical communicate user journey', async () => {
      const userId = 'communicate-user-456';
      const planId = 'GPA.3392-8909-2570-57225..1';
      const planName = 'Communicate Plan';
      const productId = 'communicate_monthly';

      // Start with no usage - should be allowed
      mockAsyncStorage.getItem.mockResolvedValue(null);
      let hasExceeded = await hasExceededCallLimit(userId, planId, planName, productId);
      expect(hasExceeded).toBe(false);

      // After 25 minutes of usage - still allowed
      let sessions = JSON.stringify([
        { startTime: Date.now() - 1500000, endTime: Date.now() - 900000, durationMinutes: 10 },
        { startTime: Date.now() - 900000, endTime: Date.now() - 0, durationMinutes: 15 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      hasExceeded = await hasExceededCallLimit(userId, planId, planName, productId);
      expect(hasExceeded).toBe(false);

      // After 35 minutes of usage - should be blocked
      sessions = JSON.stringify([
        { startTime: Date.now() - 2100000, endTime: Date.now() - 1200000, durationMinutes: 15 },
        { startTime: Date.now() - 1200000, endTime: Date.now() - 0, durationMinutes: 20 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      hasExceeded = await hasExceededCallLimit(userId, planId, planName, productId);
      expect(hasExceeded).toBe(true);
    });
  });
});