import React, { useState, useEffect } from 'react';
import { View, Text, Animated, Easing, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faStop, faLightbulb, faVolumeHigh, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import PulsingButton from '@/components/PulsingButton';
import AudioPlayerService from '@/services/AudioPlayerService';
import { GlobalFontStyleSheet, getIconSize } from '@/constants/Font';
import useDevice from '@/hooks/useDevice';
import { InteractiveText } from '@/components/shared/InteractiveText'; 
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import RubyInteractiveText from '../shared/RubyInteractiveText';
import { ProcessedMessage } from '@/types/chat';

interface GuidedModeReplyModalProps {
  isVisible: boolean;
  onClose: () => void;
  reply: string | ProcessedMessage;
  translation: string;
  language: string;
  targetLanguage: string;
  voice: string;
  voice_provider: string;
  token: string;
  audioPlayerService: AudioPlayerService;
  onReplySelect?: (reply: string) => void;
  isLoading?: boolean;
  isRecording?: boolean;
  cancelRecording?: () => Promise<void>;
  onWordTranslated?: (word: string, translation: string) => void;
  onWordSaved?: (word: string, translation: string) => void;
  chatContextFlag?: boolean;
  japaneseReadingAidFlag?: boolean;
}

const GuidedModeReplyModal: React.FC<GuidedModeReplyModalProps> = ({
  isVisible,
  reply,
  translation,
  language,
  targetLanguage,
  voice,
  voice_provider,
  audioPlayerService,
  isRecording,
  cancelRecording,
  onWordTranslated,
  onWordSaved,
  chatContextFlag = false,
  japaneseReadingAidFlag = false,
}) => {
    const { playText, stopAudio, cleanup, audioStates } = useTextToSpeech({
        language: language,
        voice: voice,
        voice_provider: voice_provider,
        audioPlayerService: audioPlayerService
      });
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isTablet } = useDevice();

  const [translateYAnim] = useState(new Animated.Value(50));
  const [opacityAnim] = useState(new Animated.Value(0));
  const [isRendered, setIsRendered] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [collapseAnim] = useState(new Animated.Value(1));
  const [pullTabOpacity] = useState(new Animated.Value(0));
  const [isGuidedModeReplyCollapsed, setIsGuidedModeReplyCollapsed] = useState(false);
  
  // Get audio state for current reply - extract text content for audio operations
  const getReplyText = (): string => {
    if (typeof reply === 'string') {
      return reply;
    }
    // For ProcessedMessage, check if it has content property
    if (reply && typeof reply === 'object' && 'content' in reply) {
      return reply.content;
    }
    return '';
  };
  const replyText = getReplyText();
  const currentAudioState = audioStates[replyText] || { isLoading: false, isPlaying: false };
  const isPlaying = currentAudioState.isPlaying;
  const isLoadingAudio = currentAudioState.isLoading;
  
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const handlePlayPause = async () => {
    triggerHaptic();
    
    // Cancel any active recording before playing or stopping audio
    if (isRecording && cancelRecording) {
      await cancelRecording();
    }
    
    if (isPlaying) {
      stopAudio(replyText);
    } else {
      playText(replyText);
    }
  };
  
  // Handle modal visibility changes
  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
      // Animate in
      Animated.parallel([
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    } else if (isRendered) {
      // Animate out
      Animated.parallel([
        Animated.timing(translateYAnim, {
          toValue: 50,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        })
      ]).start(() => {
        setIsRendered(false);
      });
    }
  }, [isVisible]);
  
  // Handle collapse/expand animations
  useEffect(() => {
    if (isGuidedModeReplyCollapsed) {
      // Collapse animation
      Animated.parallel([
        Animated.timing(collapseAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(pullTabOpacity, {
          toValue: 1,
          duration: 200,
          delay: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    } else {
      // Expand animation
      Animated.parallel([
        Animated.timing(collapseAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(pullTabOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    }
  }, [isGuidedModeReplyCollapsed]);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleToggleCollapse = () => {
    triggerHaptic();
    setIsGuidedModeReplyCollapsed(prev => !prev);
  };

  // Don't render anything if not visible and not rendered
  if (!isRendered) return null;

  return (
    <View className="mb-4 ">
      {/* Pull Tab - only visible when collapsed */}
      <Animated.View
        style={{
          opacity: pullTabOpacity,
          position: 'absolute',
          top: -10,
          left: 0,
          right: 0,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={handleToggleCollapse}
          style={{
            backgroundColor: isDark ? '#374151' : '#f3f4f6',
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 1,
            shadowColor: isDark ? '#0051BD' : '#2563eb',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <FontAwesomeIcon
            icon={faChevronUp}
            size={14}
            color={isDark ? '#9ca3af' : '#6b7280'}
          />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View 
        style={{
          transform: [
            { scale: pulseAnim },
            { translateY: translateYAnim }
          ],
          opacity: opacityAnim,
          shadowColor: isDark ? '#0051BD' : '#2563eb',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 5,
          borderRadius: 24,
          overflow: 'hidden',
        }}
        className={`${isDark ? 'bg-gray-800' : 'bg-white'} `}
      >
        {/* Header with solid background - only show when not collapsed */}
        {!isGuidedModeReplyCollapsed && (
          <View className={`px-5 py-2 rounded-t-3xl`}>
            {/* Centered collapse button at the top */}
            <View className="flex-row justify-center">
              <TouchableOpacity onPress={handleToggleCollapse}
              style={{
                backgroundColor: isDark ? '#374151' : '#f3f4f6',
                borderRadius: 12,
                paddingHorizontal: 20,
                paddingVertical: 1,
                shadowColor: isDark ? '#0051BD' : '#2563eb',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }}>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  size={16}
                  color={isDark ? '#9ca3af' : '#6b7280'}
                />
              </TouchableOpacity>
            </View>
            <View className="flex-row justify-between items-center">
              <Text style={[GlobalFontStyleSheet.textLg]} className={`pt-2 ${isDark ? 'text-gray-100' : 'text-gray-400'}`}>You could say...</Text>
              {/* Play button - disabled during loading */}
              <PulsingButton
                  onPress={handlePlayPause}
                  disabled={isLoadingAudio}
                  icon={
                      <FontAwesomeIcon
                        icon={isPlaying ? faStop : faVolumeHigh}
                        size={isTablet ? getIconSize(24) : getIconSize(28)}
                        color={isLoadingAudio ? (isDark ? "#666" : "#ccc") : (isDark ? "#fff" : "#1a2b3c")}
                      />
                  }
                  isPulsing={isLoadingAudio}
                />
            </View>
          </View>
        )}
        
        {/* Content container with conditional rendering */}
        {!isGuidedModeReplyCollapsed && (
          <Animated.View 
            style={{
              opacity: collapseAnim,
              overflow: 'hidden',
              maxHeight: Dimensions.get('window').height * 0.4, // Max 40% of screen height
            }}
          >
            <ScrollView 
              className="px-4 pb-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
            {/* Reply Text */}
            <View className="flex-row gap-3 rounded-2xl py-2 mr-5 mb-1">
              <View className="pt-1">
                  <FontAwesomeIcon 
                      icon={faLightbulb} 
                      size={isTablet ? 16 : 20} 
                      color={isDark ? "#fff" : "rgba(107 179 255 /0.8)"} 
                  />
              </View>
              <View >
                {/* Conditional rendering based on flags and reply type */}
                {chatContextFlag && typeof reply === 'object' && reply !== null ? (
                  <RubyInteractiveText 
                    textSize="base"
                    text={reply} 
                    languageCode={language || 'japanese'} 
                    targetLanguage={targetLanguage || 'english'}
                    colorScheme={isDark ? 'dark' : 'light'}
                    onWordTranslated={onWordTranslated}
                    onWordSaved={onWordSaved}
                  />
                ) : (
                  <InteractiveText 
                    textSize="base"
                    text={typeof reply === 'string' ? reply : (reply?.content || '')} 
                    languageCode={language || 'english'} 
                    targetLanguage={targetLanguage || 'english'}
                    colorScheme={isDark ? 'dark' : 'light'}
                    onWordTranslated={onWordTranslated}
                    onWordSaved={onWordSaved}
                  />
                )}
              </View>
            </View>
            
            <View className="flex-row justify-between">
              {/* Translation with fade-in animation */}
              {translation && (
                  <Animated.View 
                  className={`mb-4 px-6 mx-2  border-l border-blue-500`}
                  > 
                  <InteractiveText 
                    textSize="sm"
                    text={translation} 
                    languageCode={targetLanguage || 'english'} 
                    targetLanguage={language || 'english'}
                    colorScheme={isDark ? 'dark' : 'light'}
                    onWordTranslated={onWordTranslated}
                    onWordSaved={onWordSaved}
                    lineHeight={28}
                    tailwindClassName={`${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                  />
                  </Animated.View>
              )}
              
            </View>
            
            
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

export default GuidedModeReplyModal;
