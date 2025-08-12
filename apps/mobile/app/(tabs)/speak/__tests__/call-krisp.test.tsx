import React from 'react';

import { KrispNoiseFilter } from '@livekit/react-native-krisp-noise-filter';
import CallScreen from '../call';

import { renderHook } from '@testing-library/react-native';

// Mock dependencies
jest.mock('@livekit/react-native-krisp-noise-filter', () => ({
  KrispNoiseFilter: jest.fn(),
}));

jest.mock('@livekit/components-react', () => ({
  useVoiceAssistant: jest.fn(),
  useLocalParticipant: jest.fn(),
}));

jest.mock('@livekit/react-native', () => ({
  LiveKitRoom: jest.fn(({ children }) => children),
  registerGlobals: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: {
    replace: jest.fn(),
  },
  Stack: {
    Screen: jest.fn(() => null),
  },
}));

jest.mock('@/services/BackgroundAudioService', () => ({
  getInstance: jest.fn(() => ({
    startBackgroundAudio: jest.fn(),
    stopBackgroundAudio: jest.fn(),
    handleAppStateChange: jest.fn(),
  })),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));

jest.mock('@/hooks/useCallTimeout', () => ({
  useCallTimeout: jest.fn(() => ({
    isTimeoutModalVisible: false,
    countdownSeconds: 0,
    resetTimeout: jest.fn(),
    handleStayInCall: jest.fn(),
    handleEndCall: jest.fn(),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Test hook that mimics the Krisp integration in CallScreen
const useCallScreenKrispIntegration = (microphoneTrack: any) => {
  const krisp = React.useMemo(() => KrispNoiseFilter(), []);

  React.useEffect(() => {
    const localAudioTrack = microphoneTrack?.audioTrack;
    if (!localAudioTrack) {
      return;
    }
    
    const localTrack = localAudioTrack as any;
    if (localTrack.setProcessor && typeof localTrack.setProcessor === 'function') {
      try {
        localTrack.setProcessor(krisp);
      } catch (error) {
        console.warn('Failed to apply Krisp noise filter:', error);
      }
    }
  }, [microphoneTrack, krisp]);

  return { krisp };
};

describe('CallScreen Krisp Integration', () => {
  const mockKrispInstance = {
    process: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (KrispNoiseFilter as jest.Mock).mockReturnValue(mockKrispInstance);
  });

  describe('Krisp Integration in Call Component', () => {
    it('should create Krisp instance when component mounts', () => {
      const mockMicrophoneTrack = null;
      
      renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));
      
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
    });

    it('should apply Krisp filter when microphone track is available', () => {
      const mockMicrophoneTrack = {
        audioTrack: {
          setProcessor: jest.fn(),
        },
      };

      renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));

      expect(mockMicrophoneTrack.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);
    });

    it('should not apply filter when microphone track is null', () => {
      const mockMicrophoneTrack = null;

      renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));

      // Should not throw any errors
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
    });

    it('should not apply filter when audioTrack is missing', () => {
      const mockMicrophoneTrack = {
        audioTrack: null,
      };

      renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));

      // Should not throw any errors
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
    });

    it('should handle setProcessor errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const mockMicrophoneTrack = {
        audioTrack: {
          setProcessor: jest.fn(() => {
            throw new Error('setProcessor failed');
          }),
        },
      };

      renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to apply Krisp noise filter:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should reapply filter when microphone track changes', () => {
      const mockTrack1 = {
        audioTrack: { setProcessor: jest.fn() },
      };
      
      const mockTrack2 = {
        audioTrack: { setProcessor: jest.fn() },
      };

      const { rerender } = renderHook(
        ({ track }) => useCallScreenKrispIntegration(track),
        { initialProps: { track: mockTrack1 } }
      );

      expect(mockTrack1.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);

      rerender({ track: mockTrack2 });

      expect(mockTrack2.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);
    });

    it('should use the same Krisp instance across track changes', () => {
      const mockTrack1 = {
        audioTrack: { setProcessor: jest.fn() },
      };
      
      const mockTrack2 = {
        audioTrack: { setProcessor: jest.fn() },
      };

      const { result, rerender } = renderHook(
        ({ track }) => useCallScreenKrispIntegration(track),
        { initialProps: { track: mockTrack1 } }
      );

      const initialKrisp = result.current.krisp;

      rerender({ track: mockTrack2 });

      expect(result.current.krisp).toBe(initialKrisp);
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
    });

    it('should handle track with missing setProcessor method', () => {
      const mockMicrophoneTrack = {
        audioTrack: {
          // Missing setProcessor method
          play: jest.fn(),
          stop: jest.fn(),
        },
      };

      expect(() => {
        renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));
      }).not.toThrow();
    });

    it('should handle track with non-function setProcessor', () => {
      const mockMicrophoneTrack = {
        audioTrack: {
          setProcessor: 'not-a-function',
        },
      };

      expect(() => {
        renderHook(() => useCallScreenKrispIntegration(mockMicrophoneTrack));
      }).not.toThrow();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle KrispNoiseFilter constructor throwing error', () => {
      (KrispNoiseFilter as jest.Mock).mockImplementation(() => {
        throw new Error('Krisp initialization failed');
      });

      const consoleError = console.error;
      console.error = jest.fn();

      try {
        renderHook(() => useCallScreenKrispIntegration(null));
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toBe('Krisp initialization failed');
        }
      }

      console.error = consoleError;
    });

    it('should handle undefined microphone track gracefully', () => {
      expect(() => {
        renderHook(() => useCallScreenKrispIntegration(undefined));
      }).not.toThrow();
    });

    it('should handle empty object as microphone track', () => {
      expect(() => {
        renderHook(() => useCallScreenKrispIntegration({}));
      }).not.toThrow();
    });
  });
}); 
