import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCallTimeoutProps {
    initialTimeoutSeconds?: number;
    countdownSeconds?: number;
    onTimeout: () => void;
    isActive: boolean;
}

interface UseCallTimeoutReturn {
    isTimeoutModalVisible: boolean;
    countdownSeconds: number;
    resetTimeout: () => void;
    handleStayInCall: () => void;
    handleEndCall: () => void;
}

export const useCallTimeout = ({
    initialTimeoutSeconds = 20,
    countdownSeconds: initialCountdownSeconds = 10,
    onTimeout,
    isActive
}: UseCallTimeoutProps): UseCallTimeoutReturn => {
    const [isTimeoutModalVisible, setIsTimeoutModalVisible] = useState(false);
    const [countdownSeconds, setCountdownSeconds] = useState(initialCountdownSeconds);

    const initialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const clearAllTimers = useCallback(() => {
        if (initialTimeoutRef.current) {
            clearTimeout(initialTimeoutRef.current);
            initialTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        if (countdownTimeoutRef.current) {
            clearTimeout(countdownTimeoutRef.current);
            countdownTimeoutRef.current = null;
        }
    }, []);

    const startCountdown = useCallback(() => {
        setCountdownSeconds(initialCountdownSeconds);
        setIsTimeoutModalVisible(true);

        // Start countdown interval
        countdownIntervalRef.current = setInterval(() => {
            setCountdownSeconds(prev => {
                if (prev <= 1) {
                    clearAllTimers();
                    setIsTimeoutModalVisible(false);
                    onTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Set timeout to end call after countdown
        countdownTimeoutRef.current = setTimeout(() => {
            clearAllTimers();
            setIsTimeoutModalVisible(false);
            onTimeout();
        }, initialCountdownSeconds * 1000);
    }, [initialCountdownSeconds, onTimeout, clearAllTimers]);

    const resetTimeout = useCallback(() => {
        clearAllTimers();
        setIsTimeoutModalVisible(false);
        setCountdownSeconds(initialCountdownSeconds);

        if (isActive) {
            // Start the initial timeout
            initialTimeoutRef.current = setTimeout(() => {
                startCountdown();
            }, initialTimeoutSeconds * 1000);
        }
    }, [isActive, initialTimeoutSeconds, initialCountdownSeconds, startCountdown, clearAllTimers]);

    const handleStayInCall = useCallback(() => {
        clearAllTimers();
        setIsTimeoutModalVisible(false);
        setCountdownSeconds(initialCountdownSeconds);

        // Restart the timeout cycle
        if (isActive) {
            initialTimeoutRef.current = setTimeout(() => {
                startCountdown();
            }, initialTimeoutSeconds * 1000);
        }
    }, [isActive, initialTimeoutSeconds, initialCountdownSeconds, startCountdown, clearAllTimers]);

    const handleEndCall = useCallback(() => {
        clearAllTimers();
        setIsTimeoutModalVisible(false);
        onTimeout();
    }, [onTimeout, clearAllTimers]);

    // Start timeout when hook becomes active
    useEffect(() => {
        if (isActive) {
            resetTimeout();
        } else {
            clearAllTimers();
            setIsTimeoutModalVisible(false);
        }

        return () => {
            clearAllTimers();
        };
    }, [isActive, resetTimeout, clearAllTimers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearAllTimers();
        };
    }, [clearAllTimers]);

    return {
        isTimeoutModalVisible,
        countdownSeconds,
        resetTimeout,
        handleStayInCall,
        handleEndCall
    };
}; 
