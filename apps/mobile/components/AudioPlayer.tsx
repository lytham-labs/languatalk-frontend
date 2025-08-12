import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { GlobalFontStyleSheet } from '@/constants/Font';
import cx from 'classnames';
import { useFocusEffect } from '@react-navigation/native';
import EventBus from '@/services/EventBus';
import useDevice from '@/hooks/useDevice';

interface AudioPlayerProps {
  audioUrl: string;
  colorScheme: 'light' | 'dark';
}

export default function AudioPlayer({ 
  audioUrl,
  colorScheme
}: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const sliderWidth = useRef(0);
  const trackRef = useRef<View>(null);
  const touchStartX = useRef(0);
  const trackStartPosition = useRef(0);
  const { isTablet } = useDevice();

  // Create a ref for the latest isPlaying state
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Use a ref to record whether the audio was playing when paused via the modal
  const shouldResumeRef = useRef(false);

  useEffect(() => {
    console.log('AudioPlayer mounted with audioUrl:', audioUrl);
    loadAudio();
    return () => {
      console.log('AudioPlayer unmounting - cleaning up...');
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    const handlePauseAudio = async () => {
      const currentSound = soundRef.current;
      if (currentSound) {
        // Only pause if audio was playing at the moment of the pause event
        if (isPlayingRef.current) {
          try {
            await currentSound.pauseAsync();
            setIsPlaying(false);
            shouldResumeRef.current = true;
          } catch (error) {
            console.error('Error pausing audio via EventBus:', error);
          }
        } else {
          shouldResumeRef.current = false;
        }
      }
    };

    const handleResumeAudio = async () => {
      const currentSound = soundRef.current;
      // Resume only if we previously paused the audio due to modal interaction
      if (currentSound && shouldResumeRef.current) {
        try {
          await currentSound.playAsync();
          setIsPlaying(true);
          shouldResumeRef.current = false; // reset after resuming
        } catch (error) {
          console.error('Error resuming audio via EventBus:', error);
        }
      }
    };

    EventBus.on('pause-audio', handlePauseAudio);
    EventBus.on('resume-audio', handleResumeAudio);

    return () => {
      EventBus.off('pause-audio', handlePauseAudio);
      EventBus.off('resume-audio', handleResumeAudio);
    };
  }, []); // note: no dependencies needed here

  const loadAudio = async () => {
    try {
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }, // Changed from false to true
        onPlaybackStatusUpdate
      );
      soundRef.current = audioSound;
      setSound(audioSound);
      setIsPlaying(true); // Add this to update the play/pause button state
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && !isSeeking) {
      setIsLoaded(true);
      setIsPlaying(status.isPlaying);
      setDuration(status.durationMillis || 0);
      setProgress(status.positionMillis || 0);
    }
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const seekAudio = async (position: number) => {
    if (sound && isLoaded) {
      await sound.setPositionAsync(position);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      const pageX = evt.nativeEvent.pageX;
      setIsSeeking(true);
      if (isPlaying && sound) {
        sound.pauseAsync();
      }
      touchStartX.current = pageX;
      trackStartPosition.current = progress;
    },
    onPanResponderMove: (evt: GestureResponderEvent) => {
      if (!trackRef.current) return;
      
      const currentPageX = evt.nativeEvent.pageX;
      
      trackRef.current.measure((x, y, width, trackPageX) => {
        if (width === 0) return;
        const delta = currentPageX - touchStartX.current;
        const percentageDelta = delta / width;
        const newPercentage = (trackStartPosition.current / duration) + percentageDelta;
        const clampedPercentage = Math.max(0, Math.min(1, newPercentage));
        const newPosition = clampedPercentage * duration;
        setProgress(newPosition);
      });
    },
    onPanResponderRelease: (evt: GestureResponderEvent) => {
      if (!trackRef.current) return;
      
      const finalPageX = evt.nativeEvent.pageX;
      
      trackRef.current.measure((x, y, width, trackPageX) => {
        if (width === 0) return;
        const delta = finalPageX - touchStartX.current;
        const percentageDelta = delta / width;
        const newPercentage = (trackStartPosition.current / duration) + percentageDelta;
        const clampedPercentage = Math.max(0, Math.min(1, newPercentage));
        const newPosition = clampedPercentage * duration;
        seekAudio(newPosition);
        setIsSeeking(false);
        if (isPlaying) {
          sound?.playAsync();
        }
      });
    },
  });

  const handleTrackPress = (evt: GestureResponderEvent) => {
    if (!trackRef.current) return;
    
    const pageX = evt.nativeEvent.pageX;
    
    trackRef.current.measure((x, y, width, trackPageX) => {
      if (width === 0) return;
      const locationX = pageX - trackPageX;
      const percentage = Math.max(0, Math.min(1, locationX / width));
      const newPosition = percentage * duration;
      seekAudio(newPosition);
    });
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[
      styles.container,
      { paddingHorizontal: isTablet ? 86 : 16 }
    ]}>
      <View style={styles.timeContainer}>
        <Text style={[
          styles.timeText,
          GlobalFontStyleSheet.textSm,
          { color: colorScheme === 'dark' ? '#9ca3af' : '#666' }
        ]}>
          {formatTime(progress)} / {formatTime(duration)}
        </Text>
      </View>
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          onPress={togglePlayPause}
          style={[
            styles.playButton,
            { backgroundColor: colorScheme === 'dark' ? '#374151' : '#F3F4F6' }
          ]}
        >
          <FontAwesomeIcon 
            icon={isPlaying ? faPause : faPlay} 
            size={16} 
            color={colorScheme === 'dark' ? '#fff' : '#000'} 
          />
        </TouchableOpacity>

        <View style={styles.sliderContainer}>
          <View 
            ref={trackRef}
            style={[styles.sliderTrack, { backgroundColor: colorScheme === 'dark' ? '#4b5563' : '#E0E0E0' }]}
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleTrackPress}
          >
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${(progress / duration) * 100}%`,
                  backgroundColor: '#3b82f6',
                },
              ]}
            />
            <View
              {...panResponder.panHandlers}
              style={[
                styles.sliderThumb,
                {
                  left: `${(progress / duration) * 100}%`,
                  backgroundColor: '#3b82f6',
                  transform: [{ translateX: -8 }],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 0,
  },
  timeContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  sliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  sliderThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    top: -6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  timeText: {
    textAlign: 'center',
  },
  playButton: {
    marginRight: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 