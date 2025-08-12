import { renderHook, act } from '@testing-library/react';
import { useCallTimeMonitoring } from './useCallTimeMonitoring';
import * as CallTimeService from '@/services/CallTimeService';

// Mock the service
jest.mock('@/services/CallTimeService');

const mockCallTimeService = CallTimeService as jest.Mocked<typeof CallTimeService>;

describe('useCallTimeMonitoring', () => {
  const onLimitExceeded = jest.fn();
  const defaultProps = {
    userId: 'test-user',
    planId: 'free',
    isCallActive: true,
    onLimitExceeded,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setInterval');
    jest.spyOn(global, 'clearInterval');
    // Reset mocks before each test
    onLimitExceeded.mockClear();
    mockCallTimeService.getCallLimitUsagePercentage.mockResolvedValue(0);
    mockCallTimeService.isApproachingCallLimit.mockResolvedValue(false);
    mockCallTimeService.hasExceededCallLimitRealTime.mockResolvedValue(false);
    mockCallTimeService.getRemainingCallMinutes.mockResolvedValue(10);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should not start monitoring if call is not active', () => {
    renderHook(() => useCallTimeMonitoring({ ...defaultProps, isCallActive: false }));
    expect(setInterval).not.toHaveBeenCalled();
  });

  it('should start monitoring with a 30-second interval for low usage', async () => {
    renderHook(() => useCallTimeMonitoring(defaultProps));
    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 30000);
  });

  it('should adjust interval to 15 seconds when usage is >= 50%', async () => {
    const { result, rerender } = renderHook(() => useCallTimeMonitoring(defaultProps));
    
    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 30000);

    mockCallTimeService.getCallLimitUsagePercentage.mockResolvedValue(55);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    rerender();

    expect(result.current.usagePercentage).toBe(55);
    expect(setInterval).toHaveBeenCalledTimes(2);
    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 15000);
  });

  it('should adjust interval to 5 seconds when usage is >= 80%', async () => {
    const { result, rerender } = renderHook(() => useCallTimeMonitoring(defaultProps));

    mockCallTimeService.getCallLimitUsagePercentage.mockResolvedValue(85);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    rerender();

    expect(result.current.usagePercentage).toBe(85);
    expect(setInterval).toHaveBeenCalledTimes(2);
    expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), 5000);
  });

  it('should trigger a warning when approaching the limit', async () => {
    mockCallTimeService.isApproachingCallLimit.mockResolvedValue(true);
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    await act(async () => {
      // Advance timers to trigger the check inside the hook
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.warningTriggered).toBe(true);
    expect(CallTimeService.isApproachingCallLimit).toHaveBeenCalled();
  });

  it('should show one-minute warning when remaining time is <= 1 minute', async () => {
    mockCallTimeService.getRemainingCallMinutes.mockResolvedValue(0.8); // 48 seconds
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.showOneMinuteWarning).toBe(true);
    expect(result.current.remainingMinutes).toBe(0.8);
    expect(result.current.countdownSeconds).toBe(48); // 0.8 * 60 = 48 seconds
  });

  it('should update countdownSeconds every second when warning is active', async () => {
    mockCallTimeService.getRemainingCallMinutes
      .mockResolvedValueOnce(0.8) // Initial call - 48 seconds
      .mockResolvedValueOnce(0.75) // First countdown update - 45 seconds
      .mockResolvedValueOnce(0.7); // Second countdown update - 42 seconds
    
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    // Trigger the warning
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.showOneMinuteWarning).toBe(true);
    expect(result.current.countdownSeconds).toBe(48);

    // Advance by 1 second to trigger countdown update
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.countdownSeconds).toBe(45);

    // Advance by another second
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.countdownSeconds).toBe(42);
  });

  it('should auto-close one-minute warning when countdown reaches zero', async () => {
    mockCallTimeService.getRemainingCallMinutes
      .mockResolvedValueOnce(0.1) // Initial call - 6 seconds
      .mockResolvedValueOnce(0); // Countdown update - 0 seconds (limit reached)
    
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    // Trigger the warning
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.showOneMinuteWarning).toBe(true);
    expect(result.current.countdownSeconds).toBe(6);

    // Advance by 1 second to trigger countdown update with 0 remaining
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.showOneMinuteWarning).toBe(false);
    expect(result.current.countdownSeconds).toBe(0);
  });

  it('should not show one-minute warning if limit is already exceeded', async () => {
    mockCallTimeService.getRemainingCallMinutes.mockResolvedValue(0.5);
    mockCallTimeService.hasExceededCallLimitRealTime.mockResolvedValue(true);
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.showOneMinuteWarning).toBe(false);
    expect(result.current.showLimitExceededModal).toBe(true);
  });

  it('should trigger onLimitExceeded callback when the limit is reached', async () => {
    mockCallTimeService.hasExceededCallLimitRealTime.mockResolvedValue(true);
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    await act(async () => {
       // Advance timers to trigger the check inside the hook
      jest.advanceTimersByTime(30000);
    });
    
    expect(result.current.limitExceededTriggered).toBe(true);
    expect(result.current.showLimitExceededModal).toBe(true);
    
    // Check if onLimitExceeded is called after the 3-second timeout
    expect(onLimitExceeded).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onLimitExceeded).toHaveBeenCalledTimes(1);
  });

  it('should stop monitoring once the limit has been triggered', async () => {
    mockCallTimeService.hasExceededCallLimitRealTime.mockResolvedValue(true);
    const { rerender } = renderHook(() => useCallTimeMonitoring(defaultProps));
    
    expect(setInterval).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    
    // Rerender after limit is exceeded
    rerender();
    
    // setInterval should not be called again
    expect(clearInterval).toHaveBeenCalledTimes(1);
  });

  it('should dismiss one-minute warning when dismissOneMinuteWarning is called', async () => {
    mockCallTimeService.getRemainingCallMinutes.mockResolvedValue(0.5);
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.showOneMinuteWarning).toBe(true);
    expect(result.current.countdownSeconds).toBe(30); // 0.5 * 60 = 30 seconds

    act(() => {
      result.current.dismissOneMinuteWarning();
    });

    expect(result.current.showOneMinuteWarning).toBe(false);
    expect(clearInterval).toHaveBeenCalled(); // Countdown interval should be cleared
  });

  it('should reset all monitoring state including countdown when resetMonitoring is called', async () => {
    mockCallTimeService.getCallLimitUsagePercentage.mockResolvedValue(85);
    mockCallTimeService.isApproachingCallLimit.mockResolvedValue(true);
    mockCallTimeService.getRemainingCallMinutes.mockResolvedValue(0.5);
    const { result } = renderHook(() => useCallTimeMonitoring(defaultProps));

    // Trigger warning state
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.usagePercentage).toBe(85);
    expect(result.current.warningTriggered).toBe(true);
    expect(result.current.showOneMinuteWarning).toBe(true);
    expect(result.current.countdownSeconds).toBe(30);

    // Reset monitoring
    act(() => {
      result.current.resetMonitoring();
    });

    expect(result.current.usagePercentage).toBe(0);
    expect(result.current.warningTriggered).toBe(false);
    expect(result.current.showOneMinuteWarning).toBe(false);
    expect(result.current.countdownSeconds).toBe(0);
    expect(result.current.remainingMinutes).toBe(0);
    expect(clearInterval).toHaveBeenCalled(); // Countdown interval should be cleared
  });
}); 
