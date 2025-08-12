// Mock __DEV__ to ensure tests run with production limits (must be before imports)
(global as any).__DEV__ = false;

// Jest module mock to ensure production constants are used
jest.mock('./CallTimeService', () => {
  // Set __DEV__ to false for this mock
  (global as any).__DEV__ = false;
  
  // Import the actual module and override constants
  const actualModule = jest.requireActual('./CallTimeService');
  
  return {
    ...actualModule,
    // We can't directly override the constants since they're not exported,
    // but setting __DEV__ to false should make them use production values
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startCallSession,
  endCallSession,
  getTodaysCallDuration,
  hasExceededCallLimit,
  resetTodaysCallTime,
} from './CallTimeService'; // Assuming your service is in the same directory or adjust path

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const USER_ID = 'testUser123';
const TODAY = new Date().toISOString().split('T')[0];
const STORAGE_KEY = `callTime_${USER_ID}_${TODAY}`;

const mockDateNow = (timestamp: number) => {
  const mock = jest.spyOn(Date, 'now').mockReturnValue(timestamp);
  return mock;
};

describe('CallTimeService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.removeItem as jest.Mock).mockClear();
    jest.restoreAllMocks(); // Restores Date.now if mocked
  });

  describe('startCallSession', () => {
    it('should save a new call session with startTime and durationMinutes 0', async () => {
      const now = Date.now();
      const dateNowMock = mockDateNow(now);

      await startCallSession(USER_ID);

      const expectedSession = [{ startTime: now, durationMinutes: 0 }];
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(expectedSession));
      dateNowMock.mockRestore();
    });

    it('should not do anything if userId is not provided', async () => {
      await startCallSession('');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('endCallSession', () => {
    it('should update endTime and durationMinutes for the current session', async () => {
      const startTime = Date.now();
      const endTime = startTime + 5 * 60 * 1000; // 5 minutes later
      const initialSession = [{ startTime, durationMinutes: 0 }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(initialSession));
      const dateNowMock = mockDateNow(endTime);

      await endCallSession(USER_ID);

      const expectedDuration = 5;
      const updatedSession = [{ startTime, durationMinutes: expectedDuration, endTime }];
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(updatedSession));
      dateNowMock.mockRestore();
    });

    it('should not update a session if endTime is already set', async () => {
      const startTime = Date.now() - 10 * 60 * 1000;
      const endTime = startTime + 5 * 60 * 1000;
      const existingSession = [{ startTime, endTime, durationMinutes: 5 }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingSession));
      
      const newEndTime = Date.now();
      const dateNowMock = mockDateNow(newEndTime);

      await endCallSession(USER_ID);

      expect(AsyncStorage.setItem).not.toHaveBeenCalled(); // setItem should not be called
      dateNowMock.mockRestore();
    });

    it('should log a warning if no prior session is found for the day', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await endCallSession(USER_ID);
      
      expect(consoleWarnMock).toHaveBeenCalledWith('endCallSession called without a prior startCallSession for the day or session already ended.');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      consoleWarnMock.mockRestore();
    });

     it('should not do anything if userId is not provided', async () => {
      await endCallSession('');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('getTodaysCallDuration', () => {
    it('should return the sum of durationMinutes for today\'s sessions', async () => {
      const sessions = [
        { startTime: Date.now(), endTime: Date.now() + 2*60000, durationMinutes: 2 },
        { startTime: Date.now() + 3*60000, endTime: Date.now() + 4*60000, durationMinutes: 1 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(sessions));

      const duration = await getTodaysCallDuration(USER_ID);
      expect(duration).toBe(3);
    });

    it('should return 0 if no sessions are found for today', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const duration = await getTodaysCallDuration(USER_ID);
      expect(duration).toBe(0);
    });

    it('should return 0 and log error if AsyncStorage.getItem fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('AsyncStorage failed'));
      const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const duration = await getTodaysCallDuration(USER_ID);
      
      expect(duration).toBe(0);
      expect(consoleErrorMock).toHaveBeenCalledWith("Failed to retrieve today's call duration", expect.any(Error));
      consoleErrorMock.mockRestore();
    });

    it('should return 0 if userId is not provided', async () => {
      const duration = await getTodaysCallDuration('');
      expect(duration).toBe(0);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('hasExceededCallLimit', () => {
    const setupDurationTest = (duration: number) => {
      const sessions = [{ startTime: 0, endTime: duration * 60000, durationMinutes: duration }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(sessions));
    };

    // Free Plan Tests
    it('free plan: should return true if duration is >= 3 minutes', async () => {
      setupDurationTest(3);
      expect(await hasExceededCallLimit(USER_ID, 'free')).toBe(true);
      setupDurationTest(4);
      expect(await hasExceededCallLimit(USER_ID, 'free')).toBe(true);
    });

    it('free plan: should return false if duration is < 3 minutes', async () => {
      setupDurationTest(2.9);
      expect(await hasExceededCallLimit(USER_ID, 'free')).toBe(false);
    });

    it('free plan: should handle null planId as free', async () => {
      setupDurationTest(3);
      expect(await hasExceededCallLimit(USER_ID, null)).toBe(true);
    });

    it('free plan: should handle undefined planId as free', async () => {
      setupDurationTest(3);
      expect(await hasExceededCallLimit(USER_ID, undefined)).toBe(true);
    });

    it('free plan: should handle case-insensitive "Free" planId', async () => {
      setupDurationTest(3);
      expect(await hasExceededCallLimit(USER_ID, 'FrEe')).toBe(true);
    });

    // Communicate Plan Tests
    it('communicate plan: should return true if duration is >= 30 minutes', async () => {
      setupDurationTest(30);
      expect(await hasExceededCallLimit(USER_ID, 'pro_communicate_monthly')).toBe(true);
      setupDurationTest(31);
      expect(await hasExceededCallLimit(USER_ID, 'some_communicate_plan')).toBe(true);
    });

    it('communicate plan: should return false if duration is < 30 minutes', async () => {
      setupDurationTest(29.9);
      expect(await hasExceededCallLimit(USER_ID, 'communicate_annual')).toBe(false);
    });

    it('communicate plan: should match case-insensitively', async () => {
      setupDurationTest(30);
      expect(await hasExceededCallLimit(USER_ID, 'MyCommunicatePlan')).toBe(true);
    });

    // Unlimited/Other Plan Tests
    it('unlimited plans: should return false (under 4-hour limit) for unlimited plan IDs', async () => {
      setupDurationTest(100); // Under 240-minute limit
      expect(await hasExceededCallLimit(USER_ID, 'unlimited_annual')).toBe(false);
      expect(await hasExceededCallLimit(USER_ID, 'unlimited_monthly_1')).toBe(false);
      expect(await hasExceededCallLimit(USER_ID, 'unlimited_annual_1')).toBe(false);
    });

    it('unlimited plans: should return true when exceeding 4-hour limit', async () => {
      setupDurationTest(250); // Over 240-minute limit
      expect(await hasExceededCallLimit(USER_ID, 'unlimited_annual')).toBe(true);
      expect(await hasExceededCallLimit(USER_ID, 'unlimited_monthly_1')).toBe(true);
      expect(await hasExceededCallLimit(USER_ID, 'unlimited_annual_1')).toBe(true);
    });

    it('unlimited plans: should return false (under 4-hour limit) for unlimited plan names', async () => {
      setupDurationTest(100); // Under 240-minute limit
      expect(await hasExceededCallLimit(USER_ID, 'custom_plan', 'Unlimited Premium')).toBe(false);
      expect(await hasExceededCallLimit(USER_ID, 'custom_plan', 'Premium Unlimited Plan')).toBe(false);
    });

    it('unlimited plans: should return false (under 4-hour limit) for unlimited product IDs', async () => {
      setupDurationTest(100); // Under 240-minute limit
      expect(await hasExceededCallLimit(USER_ID, 'custom_plan', undefined, 'unlimited_product')).toBe(false);
      expect(await hasExceededCallLimit(USER_ID, 'custom_plan', undefined, 'premium_unlimited_yearly')).toBe(false);
    });

    it('other plans: should default to free plan limits', async () => {
      setupDurationTest(100); // Well over other limits
      expect(await hasExceededCallLimit(USER_ID, 'premium_monthly_2024')).toBe(true);
      expect(await hasExceededCallLimit(USER_ID, 'random_plan')).toBe(true);
    });

    it('should return false if userId is not provided', async () => {
      expect(await hasExceededCallLimit('', 'free')).toBe(false);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('resetTodaysCallTime', () => {
    it('should remove the correct key from AsyncStorage', async () => {
      await resetTodaysCallTime(USER_ID);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should not do anything if userId is not provided', async () => {
      await resetTodaysCallTime('');
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should log error if AsyncStorage.removeItem fails', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('AsyncStorage failed'));
      const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await resetTodaysCallTime(USER_ID);
      
      expect(consoleErrorMock).toHaveBeenCalledWith("Failed to reset today's call time", expect.any(Error));
      consoleErrorMock.mockRestore();
    });
  });
}); 
