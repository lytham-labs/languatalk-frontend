import AsyncStorage from '@react-native-async-storage/async-storage';

const CALL_TIME_STORAGE_KEY_PREFIX = 'callTime_';

// Development limits (much longer for testing)
const DAILY_LIMIT_FREE_MINUTES_DEV = 120; // 2 hours
const DAILY_LIMIT_COMMUNICATE_MINUTES_DEV = 480; // 8 hours

// Production limits
const DAILY_LIMIT_FREE_MINUTES_PROD = 3;
const DAILY_LIMIT_COMMUNICATE_MINUTES_PROD = 30;

// Testing limits (for dev testing of limit functionality)
const DAILY_LIMIT_FREE_MINUTES_TEST = 0.1; // 6 seconds
const DAILY_LIMIT_COMMUNICATE_MINUTES_TEST = 0.5; // 30 seconds

// Storage key for testing mode override
const TESTING_MODE_KEY = 'call_limits_testing_mode';

// Helper function to check if we're in testing mode
const getTestingMode = async (): Promise<boolean> => {
  try {
    const testingMode = await AsyncStorage.getItem(TESTING_MODE_KEY);
    return testingMode === 'true';
  } catch {
    return false;
  }
};

// Helper functions to get limits based on current mode
const getDailyLimitFreeMinutes = async (): Promise<number> => {
  const isTestingMode = await getTestingMode();
  if (isTestingMode) return DAILY_LIMIT_FREE_MINUTES_TEST;
  return __DEV__ ? DAILY_LIMIT_FREE_MINUTES_DEV : DAILY_LIMIT_FREE_MINUTES_PROD;
};

const getDailyLimitCommunicateMinutes = async (): Promise<number> => {
  const isTestingMode = await getTestingMode();
  if (isTestingMode) return DAILY_LIMIT_COMMUNICATE_MINUTES_TEST;
  return __DEV__ ? DAILY_LIMIT_COMMUNICATE_MINUTES_DEV : DAILY_LIMIT_COMMUNICATE_MINUTES_PROD;
};

interface CallSession {
  startTime: number;
  endTime?: number;
  durationMinutes: number;
}

const getTodayStorageKey = (userId: string): string => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${CALL_TIME_STORAGE_KEY_PREFIX}${userId}_${today}`;
};

// Records the start of a call session
export const startCallSession = async (userId: string): Promise<void> => {
  if (!userId) return;
  const key = getTodayStorageKey(userId);
  try {
    // Get existing sessions for the day
    const storedSessions = await AsyncStorage.getItem(key);
    let sessions: CallSession[] = storedSessions ? JSON.parse(storedSessions) : [];
    
    const newSession: CallSession = {
      startTime: Date.now(),
      durationMinutes: 0 // Duration is calculated on end
    };
    
    // Add the new session to existing sessions
    sessions.push(newSession);
    await AsyncStorage.setItem(key, JSON.stringify(sessions));
    
  } catch (error) {
    console.error('❌ Failed to save call start time', error);
  }
};

// Records the end of a call session and updates total duration for the day
export const endCallSession = async (userId: string): Promise<void> => {
  if (!userId) return;
  const key = getTodayStorageKey(userId);
  try {
    const storedSessions = await AsyncStorage.getItem(key);
    let sessions: CallSession[] = storedSessions ? JSON.parse(storedSessions) : [];

    if (sessions.length > 0) {
      const currentSession = sessions[sessions.length - 1];
      if (!currentSession.endTime) { // Only update if endTime is not already set
        currentSession.endTime = Date.now();
        currentSession.durationMinutes = (currentSession.endTime - currentSession.startTime) / (1000 * 60);
        await AsyncStorage.setItem(key, JSON.stringify(sessions));
      }
    } else {
      // This case should ideally not happen if startCallSession was called
      console.warn('endCallSession called without a prior startCallSession for the day or session already ended.');
    }
  } catch (error) {
    console.error('Failed to save call end time and duration', error);
  }
};

// Retrieves the total call duration in minutes for the user for today
export const getTodaysCallDuration = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  const key = getTodayStorageKey(userId);
  try {
    const storedSessions = await AsyncStorage.getItem(key);
    if (storedSessions) {
      const sessions: CallSession[] = JSON.parse(storedSessions);
      let totalDuration = 0;
      
      sessions.forEach(session => {
        // Only count completed sessions with both startTime and endTime
        if (session.endTime != null && session.startTime != null) {
          totalDuration += session.durationMinutes;
        }
        // Ignore active sessions without endTime as they may be inaccurate
      });

      
      return totalDuration;
    }
    return 0;
  } catch (error) {
    console.error('Failed to retrieve today\'s call duration', error);
    return 0;
  }
};

// Retrieves the total call duration including current active session for real-time monitoring
export const getRealTimeCallDuration = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  const key = getTodayStorageKey(userId);
  try {
    const storedSessions = await AsyncStorage.getItem(key);
    
    if (storedSessions) {
      const sessions: CallSession[] = JSON.parse(storedSessions);
      let totalDuration = 0;
      const currentTime = Date.now();
      
      // Add all completed sessions
      sessions.forEach((session, index) => {
        if (session.endTime != null && session.startTime != null) {
          totalDuration += session.durationMinutes;
        }
      });

      // Only add the most recent active session (to avoid hanging sessions)
      const mostRecentSession = sessions[sessions.length - 1];
      if (mostRecentSession && mostRecentSession.startTime != null && mostRecentSession.endTime == null) {
        const activeDuration = (currentTime - mostRecentSession.startTime) / (1000 * 60);
        totalDuration += activeDuration;
      }

      return totalDuration;
    }
    return 0;
  } catch (error) {
    console.error('❌ Failed to retrieve real-time call duration', error);
    return 0;
  }
};

// Checks if the user has exceeded their daily call limit (for real-time monitoring)
export const hasExceededCallLimitRealTime = async (userId: string, planId: string | null | undefined, planName?: string, productId?: string): Promise<boolean> => {
  if (!userId) return false;

  const todaysDuration = await getRealTimeCallDuration(userId);
  const dailyLimit = await getDailyLimit(planId, planName, productId);
  
  if (dailyLimit === Infinity) return false;
  return todaysDuration >= dailyLimit;
};

// Gets the daily limit for a user based on their plan
export const getDailyLimit = async (planId: string | null | undefined, planName?: string, productId?: string): Promise<number> => {
  if (!planId || planId.toLowerCase() === 'free') {
    return await getDailyLimitFreeMinutes();
  }
  
  const communicatePlanRegex = /communicate/i;
  const unlimitedPlanRegex = /unlimited/i;
  
  // Check for unlimited plans first
  if (unlimitedPlanRegex.test(planId) || 
      (planName && unlimitedPlanRegex.test(planName)) ||
      (productId && unlimitedPlanRegex.test(productId))) {
    return 240; // 4 hours for unlimited users
  }
  
  // Check plan name, product ID, or plan ID for communicate pattern
  if (communicatePlanRegex.test(planId) || 
      (planName && communicatePlanRegex.test(planName)) ||
      (productId && communicatePlanRegex.test(productId))) { 
    return await getDailyLimitCommunicateMinutes();
  }
  
  return await getDailyLimitFreeMinutes(); // Default to free plan limits
};

// Checks if user is approaching their daily limit (for warning purposes)
export const isApproachingCallLimit = async (userId: string, planId: string | null | undefined, planName?: string, productId?: string, warningThreshold: number = 0.8): Promise<boolean> => {
  if (!userId) return false;

  const todaysDuration = await getRealTimeCallDuration(userId);
  const dailyLimit = await getDailyLimit(planId, planName, productId);
  
  if (dailyLimit === Infinity) return false; // No limit
  
  return todaysDuration >= (dailyLimit * warningThreshold);
};

// Gets the percentage of daily limit used
export const getCallLimitUsagePercentage = async (userId: string, planId: string | null | undefined, planName?: string, productId?: string): Promise<number> => {
  if (!userId) return 0;

  const todaysDuration = await getRealTimeCallDuration(userId);
  const dailyLimit = await getDailyLimit(planId, planName, productId);
  
  if (dailyLimit === Infinity) return 0; // No limit
  
  return Math.min((todaysDuration / dailyLimit) * 100, 100);
};

// Gets the remaining call minutes before hitting the limit
export const getRemainingCallMinutes = async (userId: string, planId: string | null | undefined, planName?: string, productId?: string): Promise<number> => {
  if (!userId) return 0;

  const todaysDuration = await getRealTimeCallDuration(userId);
  const dailyLimit = await getDailyLimit(planId, planName, productId);
  
  if (dailyLimit === Infinity) return Infinity; // No limit
  
  const remaining = dailyLimit - todaysDuration;
  return Math.max(remaining, 0);
};

// Checks if the user has exceeded their daily call limit
export const hasExceededCallLimit = async (userId: string, planId: string | null | undefined, planName?: string, productId?: string): Promise<boolean> => {
  if (!userId) return false; // Or true, depending on how you want to handle missing userId

  const todaysDuration = await getTodaysCallDuration(userId);
  const dailyLimit = await getDailyLimit(planId, planName, productId);
  
  if (dailyLimit === Infinity) return false;
  return todaysDuration >= dailyLimit;
};

// Resets call time for a user for today (e.g., for testing or specific admin actions)
export const resetTodaysCallTime = async (userId: string): Promise<void> => {
  if (!userId) return;
  const key = getTodayStorageKey(userId);
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to reset today\'s call time', error);
  }
};

// Enable testing mode with very short limits (for development testing)
export const enableTestingMode = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(TESTING_MODE_KEY, 'true');
  } catch (error) {
    console.error('Failed to enable testing mode', error);
  }
};

// Disable testing mode (return to normal __DEV__ behavior)
export const disableTestingMode = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TESTING_MODE_KEY);
  } catch (error) {
    console.error('Failed to disable testing mode', error);
  }
};

// Check if testing mode is currently enabled
export const isTestingModeEnabled = async (): Promise<boolean> => {
  return await getTestingMode();
}; 
