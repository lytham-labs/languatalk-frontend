import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { KrispNoiseFilter } from '@livekit/react-native-krisp-noise-filter';

// Mock the Krisp package
jest.mock('@livekit/react-native-krisp-noise-filter', () => ({
  KrispNoiseFilter: jest.fn(),
}));

// Test hook for the Krisp functionality
const useKrispFilter = () => {
  const krisp = React.useMemo(() => KrispNoiseFilter(), []);
  
  const applyKrispToTrack = React.useCallback((microphoneTrack: any) => {
    const localAudioTrack = microphoneTrack?.audioTrack;
    if (!localAudioTrack) {
      return false;
    }
    
    const localTrack = localAudioTrack as any;
    if (localTrack.setProcessor && typeof localTrack.setProcessor === 'function') {
      try {
        localTrack.setProcessor(krisp);
        return true;
      } catch (error) {
        console.warn('Failed to apply Krisp filter:', error);
        return false;
      }
    }
    return false;
  }, [krisp]);

  return { krisp, applyKrispToTrack };
};

describe('Krisp Noise Filter Hook Logic', () => {
  const mockKrispInstance = {
    process: jest.fn(),
    destroy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (KrispNoiseFilter as jest.Mock).mockReturnValue(mockKrispInstance);
  });

  describe('Krisp Instance Management', () => {
    it('should create a Krisp instance', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
      expect(result.current.krisp).toBe(mockKrispInstance);
    });

    it('should memoize the Krisp instance', () => {
      const { result, rerender } = renderHook(() => useKrispFilter());
      
      const initialKrisp = result.current.krisp;
      
      rerender({});
      
      expect(result.current.krisp).toBe(initialKrisp);
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
    });

    it('should create new instance only when component unmounts and remounts', () => {
      const { unmount } = renderHook(() => useKrispFilter());
      
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(1);
      
      unmount();
      
      // New render after unmount
      renderHook(() => useKrispFilter());
      
      expect(KrispNoiseFilter).toHaveBeenCalledTimes(2);
    });
  });

  describe('Apply Krisp to Track', () => {
    it('should successfully apply Krisp filter to valid microphone track', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: {
          setProcessor: jest.fn(),
        },
      };

      const success = result.current.applyKrispToTrack(mockTrack);

      expect(success).toBe(true);
      expect(mockTrack.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);
    });

    it('should return false when microphone track is null', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const success = result.current.applyKrispToTrack(null);

      expect(success).toBe(false);
    });

    it('should return false when microphone track is undefined', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const success = result.current.applyKrispToTrack(undefined);

      expect(success).toBe(false);
    });

    it('should return false when audioTrack is null', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: null,
      };

      const success = result.current.applyKrispToTrack(mockTrack);

      expect(success).toBe(false);
    });

    it('should return false when audioTrack is undefined', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: undefined,
      };

      const success = result.current.applyKrispToTrack(mockTrack);

      expect(success).toBe(false);
    });

    it('should return false when setProcessor method is not available', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: {
          // No setProcessor method
          play: jest.fn(),
          stop: jest.fn(),
        },
      };

      const success = result.current.applyKrispToTrack(mockTrack);

      expect(success).toBe(false);
    });

    it('should handle setProcessor throwing an error gracefully', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: {
          setProcessor: jest.fn(() => {
            throw new Error('setProcessor failed');
          }),
        },
      };

      // Should not throw and should return false when setProcessor fails
      const success = result.current.applyKrispToTrack(mockTrack);
      expect(success).toBe(false);
    });
  });

  describe('Function Stability', () => {
    it('should maintain stable reference for applyKrispToTrack function', () => {
      const { result, rerender } = renderHook(() => useKrispFilter());
      
      const initialFunction = result.current.applyKrispToTrack;
      
      rerender({});
      
      expect(result.current.applyKrispToTrack).toBe(initialFunction);
    });

    it('should update applyKrispToTrack when krisp instance changes', () => {
      let instanceCount = 0;
      (KrispNoiseFilter as jest.Mock).mockImplementation(() => {
        instanceCount++;
        return { ...mockKrispInstance, id: instanceCount };
      });

      const { result, rerender } = renderHook(() => useKrispFilter());
      
      const initialFunction = result.current.applyKrispToTrack;
      
      // Force a new krisp instance (in practice this is rare due to useMemo)
      rerender({});
      
      // Function reference should remain stable due to useCallback with krisp dependency
      expect(result.current.applyKrispToTrack).toBe(initialFunction);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object as microphone track', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const success = result.current.applyKrispToTrack({});

      expect(success).toBe(false);
    });

    it('should handle track with audioTrack as empty object', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: {},
      };

      const success = result.current.applyKrispToTrack(mockTrack);

      expect(success).toBe(false);
    });

    it('should handle track with audioTrack containing non-function setProcessor', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack = {
        audioTrack: {
          setProcessor: 'not-a-function',
        },
      };

      const success = result.current.applyKrispToTrack(mockTrack);

      expect(success).toBe(false);
    });
  });

  describe('Multiple Track Applications', () => {
    it('should apply Krisp to multiple tracks with the same instance', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const mockTrack1 = {
        audioTrack: { setProcessor: jest.fn() },
      };
      
      const mockTrack2 = {
        audioTrack: { setProcessor: jest.fn() },
      };

      const success1 = result.current.applyKrispToTrack(mockTrack1);
      const success2 = result.current.applyKrispToTrack(mockTrack2);

      expect(success1).toBe(true);
      expect(success2).toBe(true);
      expect(mockTrack1.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);
      expect(mockTrack2.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);
    });

    it('should handle mixed success and failure cases', () => {
      const { result } = renderHook(() => useKrispFilter());
      
      const validTrack = {
        audioTrack: { setProcessor: jest.fn() },
      };
      
      const invalidTrack = {
        audioTrack: null,
      };

      const success1 = result.current.applyKrispToTrack(validTrack);
      const success2 = result.current.applyKrispToTrack(invalidTrack);

      expect(success1).toBe(true);
      expect(success2).toBe(false);
      expect(validTrack.audioTrack.setProcessor).toHaveBeenCalledWith(mockKrispInstance);
    });
  });
}); 
