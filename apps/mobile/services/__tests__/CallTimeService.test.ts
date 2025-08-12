import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startCallSession,
  endCallSession,
  getTodaysCallDuration,
  getDailyLimit,
  hasExceededCallLimit,
  hasExceededCallLimitRealTime,
  resetTodaysCallTime,
} from '../CallTimeService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock __DEV__ for production testing
const originalDev = (global as any).__DEV__;

describe('CallTimeService', () => {
  const mockUserId = 'test-user-123';
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to production mode by default
    (global as any).__DEV__ = false;
  });

  afterAll(() => {
    (global as any).__DEV__ = originalDev;
  });

  describe('Plan Type Detection', () => {
    describe('Production Mode', () => {
      beforeEach(() => {
        (global as any).__DEV__ = false;
      });

      const testCases = [
        {
          description: 'detect Google Play Store communicate plan by ID',
          planId: 'GPA.3392-8909-2570-57225..1',
          planName: 'Communicate Plan',
          productId: 'communicate_monthly',
          expected: 30
        },
        {
          description: 'detect communicate plan by name',
          planId: 'some-other-id',
          planName: 'Communicate Annual',
          productId: null,
          expected: 30
        },
        {
          description: 'detect communicate plan by product ID',
          planId: 'some-id',
          planName: 'Plan Name',
          productId: 'communicate_yearly',
          expected: 30
        },
        {
          description: 'default to free plan limits',
          planId: 'free',
          planName: 'Free Plan',
          productId: 'free',
          expected: 3
        },
        {
          description: 'handle null plan values',
          planId: null,
          planName: null,
          productId: null,
          expected: 3
        },
        {
          description: 'handle undefined plan values',
          planId: undefined,
          planName: undefined,
          productId: undefined,
          expected: 3
        }
      ];

      testCases.forEach(({ description, planId, planName, productId, expected }) => {
        it(`should ${description}`, async () => {
          const limit = await getDailyLimit(planId, planName, productId);
          expect(limit).toBe(expected);
        });
      });
    });

    describe('Development Mode', () => {
      beforeEach(() => {
        (global as any).__DEV__ = true;
      });

      const testCases = [
        {
          description: 'detect communicate plan in dev mode',
          planId: 'communicate_plan',
          expected: 480
        },
        {
          description: 'default to free plan limits in dev mode',
          planId: 'free',
          expected: 120
        }
      ];

      testCases.forEach(({ description, planId, expected }) => {
        it(`should ${description}`, async () => {
          const limit = await getDailyLimit(planId);
          expect(limit).toBe(expected);
        });
      });
    });
  });

  describe('Development vs Production Limits', () => {
    it('should use production limits by default', async () => {
      (global as any).__DEV__ = false;
      
      expect(await getDailyLimit('free')).toBe(3);
      expect(await getDailyLimit('communicate_plan')).toBe(30);
    });

    it('should use development limits in dev mode', async () => {
      (global as any).__DEV__ = true;
      
      expect(await getDailyLimit('free')).toBe(120);
      expect(await getDailyLimit('communicate_plan')).toBe(480);
    });
  });

  describe('Call Session Management', () => {
    const todayKey = `callTime_${mockUserId}_${new Date().toISOString().split('T')[0]}`;

    it('should start a new call session', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      await startCallSession(mockUserId);

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(todayKey);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        todayKey,
        expect.stringContaining('startTime')
      );
    });

    it('should add to existing sessions', async () => {
      const existingSessions = JSON.stringify([
        { startTime: Date.now() - 10000, endTime: Date.now() - 5000, durationMinutes: 0.08 }
      ]);
      
      mockAsyncStorage.getItem.mockResolvedValue(existingSessions);
      mockAsyncStorage.setItem.mockResolvedValue();

      await startCallSession(mockUserId);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        todayKey,
        expect.stringMatching(/.*startTime.*startTime.*/) // Should have two sessions
      );
    });

    it('should handle empty userId gracefully', async () => {
      await startCallSession('');
      expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      
      // Should not throw
      await expect(startCallSession(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('Call Limit Checking', () => {
    beforeEach(() => {
      // Mock current time for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));
      // Ensure production mode for consistent limits
      (global as any).__DEV__ = false;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return false when no usage exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const hasExceeded = await hasExceededCallLimit(mockUserId, 'free');
      expect(hasExceeded).toBe(false);
    });

    it('should return false when under limit', async () => {
      const sessions = JSON.stringify([
        { startTime: Date.now() - 10000, endTime: Date.now() - 5000, durationMinutes: 1 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      
      const hasExceeded = await hasExceededCallLimit(mockUserId, 'free');
      expect(hasExceeded).toBe(false);
    });

    it('should return true when over limit for free plan', async () => {
      const sessions = JSON.stringify([
        { startTime: Date.now() - 20000, endTime: Date.now() - 15000, durationMinutes: 2 },
        { startTime: Date.now() - 10000, endTime: Date.now() - 5000, durationMinutes: 2 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      
      const hasExceeded = await hasExceededCallLimit(mockUserId, 'free');
      expect(hasExceeded).toBe(true);
    });

    it('should return true when over limit for communicate plan', async () => {
      const sessions = JSON.stringify([
        { startTime: Date.now() - 20000, endTime: Date.now() - 15000, durationMinutes: 20 },
        { startTime: Date.now() - 10000, endTime: Date.now() - 5000, durationMinutes: 15 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      
      const hasExceeded = await hasExceededCallLimit(mockUserId, 'communicate_plan');
      expect(hasExceeded).toBe(true);
    });

    it('should handle real-time checking with active session', async () => {
      const activeStartTime = Date.now() - 180000; // 3 minutes ago
      const sessions = JSON.stringify([
        { startTime: activeStartTime, durationMinutes: 0 } // Active session
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      
      const hasExceeded = await hasExceededCallLimitRealTime(
        mockUserId, 
        'free',
        undefined,
        undefined,
        activeStartTime
      );
      expect(hasExceeded).toBe(true);
    });
  });

  describe('Usage Calculation', () => {
    beforeEach(() => {
      (global as any).__DEV__ = false;
    });

    it('should calculate total usage correctly', async () => {
      const sessions = JSON.stringify([
        { startTime: Date.now() - 20000, endTime: Date.now() - 15000, durationMinutes: 1.5 },
        { startTime: Date.now() - 10000, endTime: Date.now() - 5000, durationMinutes: 2.0 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(sessions);
      
      const usage = await getTodaysCallDuration(mockUserId);
      expect(usage).toBe(3.5);
    });

    it('should return 0 when no sessions exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      const usage = await getTodaysCallDuration(mockUserId);
      expect(usage).toBe(0);
    });

    it('should handle malformed session data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('invalid json');
      
      const usage = await getTodaysCallDuration(mockUserId);
      expect(usage).toBe(0);
    });
  });

  describe('Call History Management', () => {
    beforeEach(() => {
      (global as any).__DEV__ = false;
    });

    it('should reset call history', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();
      
      await resetTodaysCallTime(mockUserId);
      
      const expectedKey = `callTime_${mockUserId}_${new Date().toISOString().split('T')[0]}`;
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle resetTodaysCallTime errors gracefully', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Remove error'));
      
      await expect(resetTodaysCallTime(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple plan parameters correctly', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      // Test with RevenueCat Google Play Store plan
      const hasExceeded = await hasExceededCallLimit(
        mockUserId,
        'GPA.3392-8909-2570-57225..1',
        'Communicate Plan',
        'communicate_monthly'
      );
      
      expect(hasExceeded).toBe(false);
    });

    it('should prioritize plan detection by ID first, then name, then productId', async () => {
      (global as any).__DEV__ = false;
      
      // Test priority: ID has 'communicate', name doesn't
      expect(await getDailyLimit('communicate_test', 'free_plan')).toBe(30);
      
      // Test priority: ID doesn't have 'communicate', name does  
      expect(await getDailyLimit('some_id', 'communicate_plan')).toBe(30);
      
      // Test priority: Neither ID nor name, but productId does
      expect(await getDailyLimit('some_id', 'some_name', 'communicate_yearly')).toBe(30);
    });

    it('should handle session end without start', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();
      
      // Should not throw when ending session that doesn't exist
      await expect(endCallSession(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should simulate a complete call session flow', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();
      
      // Start session
      await startCallSession(mockUserId);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
      
      // Simulate some time passing and end session
      const mockEndSessions = JSON.stringify([
        { startTime: Date.now() - 120000, durationMinutes: 0 }
      ]);
      mockAsyncStorage.getItem.mockResolvedValue(mockEndSessions);
      
      await endCallSession(mockUserId);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid successive calls correctly', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();
      
      // Start multiple sessions quickly
      await Promise.all([
        startCallSession(mockUserId),
        startCallSession(mockUserId),
        startCallSession(mockUserId)
      ]);
      
      // Should have been called for each session
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(3);
    });
  });
});