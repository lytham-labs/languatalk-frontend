import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  hasExceededCallLimitRealTime, 
  isApproachingCallLimit, 
  getCallLimitUsagePercentage,
  getRemainingCallMinutes,
  getRealTimeCallDuration,
  getDailyLimit
} from '@/services/CallTimeService';

interface CallMonitoringState {
  usagePercentage: number;
  warningTriggered: boolean;
  limitExceededTriggered: boolean;
  showLimitExceededModal: boolean;
  showOneMinuteWarning: boolean;
  remainingMinutes: number;
  countdownSeconds: number;
}

interface CallMonitoringHookProps {
  userId: string | null;
  planId: string | null | undefined;
  planName?: string;
  productId?: string;
  isCallActive: boolean;
  onLimitExceeded: () => void;
}

export const useCallTimeMonitoring = ({ 
  userId, 
  planId, 
  planName,
  productId,
  isCallActive, 
  onLimitExceeded 
}: CallMonitoringHookProps): CallMonitoringState & {
  dismissLimitModal: () => void;
  dismissOneMinuteWarning: () => void;
  resetMonitoring: () => void;
} => {
  const [usagePercentage, setUsagePercentage] = useState(0);
  const [warningTriggered, setWarningTriggered] = useState(false);
  const [limitExceededTriggered, setLimitExceededTriggered] = useState(false);
  const [showLimitExceededModal, setShowLimitExceededModal] = useState(false);
  const [showOneMinuteWarning, setShowOneMinuteWarning] = useState(false);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [oneMinuteWarningTriggered, setOneMinuteWarningTriggered] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  
  // Refs to manage timeouts and prevent multiple calls
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onLimitExceededCalledRef = useRef(false);
  const checkCallDurationRef = useRef<() => Promise<void>>();
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkCallDuration = useCallback(async () => {
    if (!userId || !planId) return;

    try {
      // Get current usage percentage and remaining minutes
      const currentUsage = await getCallLimitUsagePercentage(userId, planId, planName, productId);
      const remaining = await getRemainingCallMinutes(userId, planId, planName, productId);
      
      setUsagePercentage(currentUsage);
      setRemainingMinutes(remaining);

      // Check if approaching limit (80% threshold)
      const approaching = await isApproachingCallLimit(userId, planId, planName, productId, 0.8);
      if (approaching && !warningTriggered) {
        setWarningTriggered(true);
      }

      // Check for 1-minute warning (only if not already triggered and limit not exceeded)
      if (remaining <= 1 && remaining > 0 && !oneMinuteWarningTriggered && !limitExceededTriggered) {
        setOneMinuteWarningTriggered(true);
        setShowOneMinuteWarning(true);
        
        // Start countdown
        const startCountdown = () => {
          setCountdownSeconds(Math.ceil(remaining * 60)); // Convert minutes to seconds
          
          // Clear any existing countdown interval
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          
          // Update countdown every second
          countdownIntervalRef.current = setInterval(async () => {
            try {
              const currentRemaining = await getRemainingCallMinutes(userId, planId, planName, productId);
              const secondsLeft = Math.max(0, Math.ceil(currentRemaining * 60));
              setCountdownSeconds(secondsLeft);
              
              // Auto-close warning if limit exceeded
              if (currentRemaining <= 0) {
                setShowOneMinuteWarning(false);
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
              }
            } catch (error) {
              console.error('Error updating countdown:', error);
            }
          }, 1000);
        };
        
        startCountdown();
      }

      // Check if limit exceeded
      const limitExceeded = await hasExceededCallLimitRealTime(userId, planId, planName, productId);
      if (limitExceeded && !limitExceededTriggered && !onLimitExceededCalledRef.current) {
        setLimitExceededTriggered(true);
        setShowLimitExceededModal(true);
        // Hide one minute warning if it's showing
        setShowOneMinuteWarning(false);
        // Auto-disconnect after showing modal
        timeoutRef.current = setTimeout(() => {
          if (!onLimitExceededCalledRef.current) {
            onLimitExceededCalledRef.current = true;
            onLimitExceeded();
          }
        }, 3000); // Give user 3 seconds to see the modal
      }
    } catch (error) {
      console.error('❌ Error checking call duration:', error);
    }
  }, [userId, planId, planName, productId, warningTriggered, limitExceededTriggered, oneMinuteWarningTriggered, onLimitExceeded]);

  // Update the ref when the function changes
  useEffect(() => {
    checkCallDurationRef.current = checkCallDuration;
  }, [checkCallDuration]);

  // Dynamic monitoring with intervals based on usage
  useEffect(() => {
    if (!isCallActive || !userId || !planId || limitExceededTriggered) {
      return;
    }

    let intervalTime = 30000; // Default 30 seconds
    if (usagePercentage >= 80) {
      intervalTime = 5000; // 5 seconds when close to limit
    } else if (usagePercentage >= 50) {
      intervalTime = 15000; // 15 seconds when approaching limit
    }

    const interval = setInterval(() => {
      if (checkCallDurationRef.current) {
        checkCallDurationRef.current();
      }
    }, intervalTime);

    return () => {
      clearInterval(interval);
    };
  }, [isCallActive, userId, planId, limitExceededTriggered, usagePercentage]);

  const dismissLimitModal = useCallback(() => {
    setShowLimitExceededModal(false);
    // Clear timeout to prevent double execution
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Ensure onLimitExceeded is called when modal is dismissed
    if (!onLimitExceededCalledRef.current) {
      onLimitExceededCalledRef.current = true;
      onLimitExceeded();
    }
  }, [onLimitExceeded]);

  const dismissOneMinuteWarning = useCallback(() => {
    setShowOneMinuteWarning(false);
    // Clear countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const resetMonitoring = useCallback(() => {
    setUsagePercentage(0);
    setWarningTriggered(false);
    setLimitExceededTriggered(false);
    setShowLimitExceededModal(false);
    setShowOneMinuteWarning(false);
    setRemainingMinutes(0);
    setOneMinuteWarningTriggered(false);
    setCountdownSeconds(0);
    onLimitExceededCalledRef.current = false;
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Clear countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Cleanup timeout and countdown on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  return {
    usagePercentage,
    warningTriggered,
    limitExceededTriggered,
    showLimitExceededModal,
    showOneMinuteWarning,
    remainingMinutes,
    countdownSeconds,
    dismissLimitModal,
    dismissOneMinuteWarning,
    resetMonitoring
  };
};
