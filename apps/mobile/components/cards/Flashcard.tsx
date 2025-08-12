import React, { useRef, useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Text,
  } from "react-native";
import { FontAwesomeIcon } from "@fortawesome/react-native-fontawesome";
import { faVolumeHigh, faEye, faTrash, faPencil, faXmark, faCheck, faQuestion, faCircleInfo, faLightbulb, faPlus } from "@fortawesome/pro-solid-svg-icons";
import { colorScheme } from "nativewind";
import { ThemedText } from "@/components/shared/ThemedText";
import { GlobalFontStyleSheet } from "@/constants/Font";
import { ThemedView } from "@/components/shared/ThemedView";
import CardActionButtons from "@/components/cards/CardActionButtons";
import FlashcardService from '@/services/FlashcardService';
import { BlurView } from 'expo-blur';
import VocabModal from "@/components/cards/VocabModal";
import AudioPlayerService from '@/services/AudioPlayerService';
import { FlashcardEvaluationService, EvaluationResult } from '@/services/FlashcardEvaluationService';
import BouncingDots from '@/components/BouncingDots';
import SlidingModal from '@/components/shared/SlidingModal';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25; // Increased from 0.15 to 0.25
const DOWNWARD_SWIPE_THRESHOLD = SCREEN_HEIGHT * 0.15; // Changed from UPWARD to DOWNWARD
const CARD_HEIGHT = 500;

// Update color constants with more subtle colors
const SWIPE_COLORS = {
  left: 'rgba(255, 75, 75, 0.6)',    // Lighter red for wrong
  right: 'rgba(76, 175, 80, 0.6)',   // Lighter green for correct
  up: 'rgba(255, 184, 0, 0.6)',      // Lighter yellow/orange for "knew it but guessed"
  default: '#000000'                  // Default border color
};

// Add message constants
const SWIPE_MESSAGES = {
  left: "didn't know",
  right: "knew it!",
  down: "guessed correctly" // Changed from 'up' to 'down' and updated message
};

// Add to your constants
const MESSAGES = {
  ...SWIPE_MESSAGES,
  flip: "tap card to reveal answer"
};

// Add this helper function near the top of the file, after the imports
const renderTextWithBold = (text: string) => {
  // Handle both single (*word*) and double (**word**) asterisks
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Double asterisks - make colored
      return (
        <Text key={index} style={{ fontFamily: 'lato-bold', color: '#32CC49' }}>
          {part.slice(2, -2)}
        </Text>
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      // Single asterisks - make colored
      return (
        <Text key={index} style={{ color: '#32CC49' }}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
};

// Add this near the top of the file, after imports
const isAndroid = Platform.OS === 'android';

interface FlashcardProps {
  frontContent: string;
  backContent: string;
  contextSentence?: string;
  isFlipped: boolean;
  onFlip: () => void;
  onPlayAudio: () => void;
  isLoadingAudio: boolean;
  onSwipe: (direction: "left" | "right" | "down") => void;
  isExiting?: boolean;
  style?: any;
  onFlipComplete?: () => void;
  isListenMode?: boolean;
  isProduceMode?: boolean;
  isClozeMode?: boolean;
  hideAudio?: boolean;
  hasBeenFlipped: boolean;
  flashcardService: FlashcardService;
  language: string;
  hideWord?: boolean;
  onRevealWord?: () => void;
  isWord?: boolean;
  onDelete?: () => void;
  onUpdateTags?: (id: string, newTags: string) => void;
  onUpdateTranslation?: (id: string, newTranslation: string) => void;
  onUpdateFront?: (id: string, newFront: string) => void;
  id: string;
  tags: string[];
  word_info?: {
    article?: string;
    explain: string;
    gender?: string;
    human_readable: string;
    lemma: string;
    morph: string;
    pos: string;
    processed_token: string;
    tag: string;
    text: string;
    token_text: string;
  } | null;
  onTranscriptionComplete?: (text: string) => void;
  userGuess?: string;
  evaluation?: EvaluationResult | null;
  isEvaluating?: boolean;
  translation?: string;
  // Hint-related props
  onHint?: () => void;
  showHints?: boolean;
  hintExample?: { source: string; translation: string } | null;
  isLoadingHint?: boolean;
  hintError?: string | null;
  onSaveHint?: () => void;
  // Original content for editing (e.g., in cloze mode)
  originalFront?: string;
  originalBack?: string;
}

function calculateFontSize(text: string): number {
  const baseSize = 40;
  const maxLength = 12; // baseline length for full size font

  if (text.length <= maxLength) return baseSize;

  // Reduce font size proportionally, but don't go smaller than 20
  return Math.max(20, baseSize * (maxLength / text.length));
}

export default function Flashcard({
  frontContent,
  backContent,
  contextSentence,
  isFlipped,
  onFlip,
  onPlayAudio,
  isLoadingAudio,
  onSwipe,
  isExiting,
  style,
  onFlipComplete,
  isListenMode = false,
  isProduceMode = false,
  isClozeMode = false,
  hideAudio = false,
  hasBeenFlipped,
  flashcardService,
  language,
  hideWord = false,
  onRevealWord = () => {},
  isWord = false,
  onDelete,
  onUpdateTags,
  onUpdateTranslation,
  onUpdateFront,
  id,
  tags,
  word_info,
  userGuess,
  evaluation,
  isEvaluating,
  translation,
  onHint,
  showHints,
  hintExample,
  isLoadingHint,
  hintError,
  onSaveHint,
  originalFront,
  originalBack,
}: FlashcardProps) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const borderColorAnim = useRef(new Animated.Value(0)).current;
  const borderWidthAnim = useRef(new Animated.Value(0)).current;
  const touchStartTime = useRef(0);
  const hasBeenFlippedRef = useRef(hasBeenFlipped);
  const isListenModeRef = useRef(isListenMode);
  const hideWordRef = useRef(hideWord);
  const isFlippedRef = useRef(isFlipped);
  const textFadeOut = useRef(new Animated.Value(1)).current;
  const messageFadeIn = useRef(new Animated.Value(0)).current;
  const borderIntensity = useRef(new Animated.Value(0)).current;
  const [currentGesture, setCurrentGesture] = useState({ dx: 0, dy: 0 });
  const [currentMessage, setCurrentMessage] = useState('');
  const blurFadeAnim = useRef(new Animated.Value(1)).current;
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const saveHintScale = useRef(new Animated.Value(1)).current;
  const [isHintSaved, setIsHintSaved] = useState(false);

  useEffect(() => {
    hasBeenFlippedRef.current = hasBeenFlipped;
    isListenModeRef.current = isListenMode;
    hideWordRef.current = hideWord;
    isFlippedRef.current = isFlipped;
  }, [hasBeenFlipped, isListenMode, hideWord, isFlipped]);

  const getBorderColor = (dx: number, dy: number) => {
    // Calculate the angle of movement
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Downward swipe (between 60 and 120 degrees)
    if (angle > 60 && angle < 120 && Math.abs(dy) > DOWNWARD_SWIPE_THRESHOLD / 2) {
      return 3; // down (orange)
    }
    
    // Left/Right swipe
    if (distance > SWIPE_THRESHOLD / 2) {
      if (Math.abs(angle) < 45) {
        return 1; // right (green)
      }
      if (Math.abs(angle) > 135) {
        return 2; // left (red)
      }
    }
    
    return 0; // default (no border)
  };

  const interpolatedBorderColor = borderColorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [SWIPE_COLORS.default, SWIPE_COLORS.right, SWIPE_COLORS.left, SWIPE_COLORS.up]
  });

  const getBorderWidth = (dx: number, dy: number) => {
    const horizontalProgress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
    const verticalProgress = Math.min(Math.abs(dy) / DOWNWARD_SWIPE_THRESHOLD, 1);
    return Math.max(horizontalProgress, verticalProgress) * 4; // Max border width of 4
  };

  const getSwipeMessage = (dx: number, dy: number) => {
    // Calculate the angle of movement
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Downward swipe (between 60 and 120 degrees)
    if (angle > 60 && angle < 120 && Math.abs(dy) > DOWNWARD_SWIPE_THRESHOLD / 2) {
      return SWIPE_MESSAGES.down;
    }
    
    // Left/Right swipe
    if (distance > SWIPE_THRESHOLD / 2) {
      if (Math.abs(angle) < 45) {
        return SWIPE_MESSAGES.right;
      }
      if (Math.abs(angle) > 135) {
        return SWIPE_MESSAGES.left;
      }
    }
    
    return '';
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // Don't capture touches when blur overlay is active
        return !(isListenModeRef.current && hideWordRef.current && !isFlippedRef.current && !hasBeenFlippedRef.current);
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10;
      },
      onPanResponderGrant: () => {
        touchStartTime.current = Date.now();
        // Smaller scale change to maintain visibility
        Animated.spring(scale, {
          toValue: 0.98,
          useNativeDriver: true,
          tension: 100,
          friction: 7,
        }).start();
      },
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });
        
        const rotationValue = gesture.dx / 25;
        rotation.setValue(rotationValue);

        setCurrentGesture({ dx: gesture.dx, dy: gesture.dy });

        // Calculate progress for fade effects
        const horizontalProgress = Math.min(Math.abs(gesture.dx) / SWIPE_THRESHOLD, 1);
        const verticalProgress = Math.min(Math.abs(gesture.dy) / DOWNWARD_SWIPE_THRESHOLD, 1);
        const progress = Math.max(horizontalProgress, verticalProgress);

        // Update animations based on progress
        textFadeOut.setValue(1 - progress);
        messageFadeIn.setValue(progress);

        if (!hasBeenFlippedRef.current) {
          // If card hasn't been flipped, always show gray border and flip message
          borderColorAnim.setValue(0);
          borderWidthAnim.setValue(progress * 4); // Still show border width animation
          setCurrentMessage(MESSAGES.flip);
        } else {
          // Normal behavior when card has been flipped
          const colorValue = getBorderColor(gesture.dx, gesture.dy);
          borderColorAnim.setValue(colorValue);
          borderWidthAnim.setValue(getBorderWidth(gesture.dx, gesture.dy));
          const message = getSwipeMessage(gesture.dx, gesture.dy);
          setCurrentMessage(message);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        // Reset gesture and message
        setCurrentGesture({ dx: 0, dy: 0 });
        setCurrentMessage('');
        
        // Reset all animations if not completing swipe
        if (!hasBeenFlippedRef.current || 
            (Math.abs(gesture.dx) <= SWIPE_THRESHOLD && 
             gesture.dy >= -DOWNWARD_SWIPE_THRESHOLD)) {
          Animated.parallel([
            Animated.spring(textFadeOut, { toValue: 1, useNativeDriver: true }),
            Animated.spring(messageFadeIn, { toValue: 0, useNativeDriver: true }),
            Animated.spring(borderIntensity, { toValue: 0, useNativeDriver: true }),
          ]).start();
        }
        // Reset border
        borderColorAnim.setValue(0);
        borderWidthAnim.setValue(0);

        // Quick reset of scale
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200, // Higher tension for quicker reset
          friction: 12,
        }).start();

        const touchDuration = Date.now() - touchStartTime.current;
        const isQuickTouch = touchDuration < 200;
        const hasMovedSignificantly = 
          Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10;

        if (isQuickTouch && !hasMovedSignificantly) {
          onFlip();
          resetPanAnimation();
          return;
        }

        const { dx, dy } = gesture;

        if (hasBeenFlippedRef.current) {
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            const direction = dx > 0 ? "right" : "left";
            onSwipe(direction);
            
            Animated.parallel([
              Animated.timing(pan, {
                toValue: { x: dx > 0 ? SCREEN_WIDTH * 2 : -SCREEN_WIDTH * 2, y: dy },
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(rotation, {
                toValue: dx > 0 ? 30 : -30,
                duration: 500,
                useNativeDriver: true,
              })
            ]).start(() => {
              resetPanAnimation();
            });
          } else if (dy > DOWNWARD_SWIPE_THRESHOLD) { // Changed from dy < -UPWARD_SWIPE_THRESHOLD
            onSwipe("down"); // Changed from "up"
            
            Animated.parallel([
              Animated.timing(pan, {
                toValue: { x: 0, y: SCREEN_HEIGHT }, // Changed from -SCREEN_HEIGHT
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.spring(scale, {
                toValue: 0.5,
                useNativeDriver: true,
                tension: 20,
                friction: 8,
              })
            ]).start(() => {
              resetPanAnimation();
            });
          } else {
            resetPanAnimation();
          }
        } else {
          resetPanAnimation();
        }
      },
    })
  ).current;

  const resetPanAnimation = () => {
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        tension: 40,
        friction: 5
      }),
      Animated.spring(rotation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 5
      })
    ]).start();
  };

  useEffect(() => {
    console.log('hasBeenFlipped', hasBeenFlipped);

    Animated.spring(flipAnim, {
      toValue: isFlipped ? 1 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isFlipped) {
        onFlipComplete?.();
      }
    });
  }, [isFlipped]);

  const frontAnimatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale },
      { rotate: rotation.interpolate({
        inputRange: [-30, 30],
        outputRange: ['-15deg', '15deg'] // Reduced rotation range
      })},
      {
        rotateX: flipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
    backfaceVisibility: "hidden" as const,
    zIndex: isFlipped ? 0 : 1,
    position: "absolute" as const,
    width: SCREEN_WIDTH * 0.85,
    height: CARD_HEIGHT,
  };

  const backAnimatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale },
      { rotate: rotation.interpolate({
        inputRange: [-30, 30],
        outputRange: ['-15deg', '15deg'] // Reduced rotation range
      })},
      {
        rotateX: flipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["180deg", "360deg"],
        }),
      },
    ],
    backfaceVisibility: "hidden" as const,
    zIndex: isFlipped ? 1 : 0,
    position: "absolute" as const,
    width: SCREEN_WIDTH * 0.85,
    height: CARD_HEIGHT,
  };

  const cardContentStyle = {
    ...styles.cardContent,
    borderColor: interpolatedBorderColor,
    borderWidth: borderWidthAnim,
    backgroundColor: colorScheme.get() === "dark" ? "#3D4752" : "white",
    position: 'relative' as const,
  };

  // Add type for the color interpolation
  const messageColorInterpolation = borderColorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [
      SWIPE_COLORS.default,
      SWIPE_COLORS.right,
      SWIPE_COLORS.left,
      SWIPE_COLORS.up
    ]
  }) as unknown as string;  // Type assertion to handle the animated color

  // Add this function to handle tap events
  const handleTap = (e: any) => {
    e.stopPropagation();
    onFlip();
  };

  const handleSaveHint = (e: any) => {
    e.stopPropagation();
    
    // Trigger the scale animation
    Animated.sequence([
      Animated.spring(saveHintScale, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 400,
        friction: 3,
      }),
      Animated.spring(saveHintScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 400,
        friction: 8,
      })
    ]).start();
    
    // Set saved state temporarily
    setIsHintSaved(true);
    
    // Call the original save function
    onSaveHint?.();
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
        style={styles.actionButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FontAwesomeIcon
          icon={faTrash}
          size={15}
          color={colorScheme.get() === "dark" ? "#ffffff" : "#3D4752"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          setShowVocabModal(true);
        }}
        style={styles.actionButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FontAwesomeIcon
          icon={faPencil}
          size={15}
          color={colorScheme.get() === "dark" ? "#ffffff" : "#3D4752"}
        />
      </TouchableOpacity>
    </View>
  );

  const renderHintButton = () => (
    showHints && !hasBeenFlipped && onHint && !tags?.some(tag => tag === 'sentence') && (
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onHint();
          // Remove blur overlay in listen mode when hint is clicked
          if (isListenMode && hideWord) {
            onRevealWord();
          }
        }}
        style={styles.hintButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FontAwesomeIcon
          icon={faLightbulb}
          size={18}
          color="#FCD34D" // Yellow color for the lightbulb
        />
      </TouchableOpacity>
    )
  );

  // Update the card content render to include the message overlay
  const renderCardContent = (content: string, isBack: boolean) => (
    <Animated.View style={cardContentStyle}>
      <Animated.View style={{ opacity: textFadeOut }}>
        <View style={{ position: 'relative' }}>
          <ThemedText
            style={[
              GlobalFontStyleSheet.text2Xl,
              { 
                fontSize: calculateFontSize(content),
                lineHeight: 34
              },
            ]}
            className="font-bold text-center pt-10"
          >
            {renderTextWithBold(content)}
          </ThemedText>

          {/* Show translation for cloze mode on back side */}
          {isClozeMode && isBack && translation && (
            <ThemedText
              style={[
                GlobalFontStyleSheet.textBase,
                { textAlign: 'center', marginTop: 16, lineHeight: 22 }
              ]}
              className="text-gray-600 dark:text-gray-400 italic px-4"
            >
              {renderTextWithBold(translation)}
            </ThemedText>
          )}

          {isWord && word_info?.human_readable && (
            <>
              <ThemedText
                style={[
                  GlobalFontStyleSheet.textSm,
                  { textAlign: 'center', marginTop: 8 }
                ]}
                className="text-gray-500"
              >
                {(isBack && isProduceMode) || (!isBack && !isProduceMode) ? (
                  <>
                    {word_info.human_readable}
                    {(word_info?.pos === 'Verb' || word_info?.pos === 'Auxiliary') && word_info?.lemma && word_info.lemma !== frontContent && word_info.lemma !== backContent && (
                      <>{' '}Infinitive: {word_info.lemma}</>
                    )}
                  </>
                ) : null}
              </ThemedText>
            </>
          )}

          {/* Show hint example under the word on the front side - only for words and phrases */}
          {!isBack && showHints && (!hasBeenFlipped || isClozeMode) && !tags?.some(tag => tag === 'sentence') && (hintExample || isLoadingHint || hintError) && (
            <View style={{ marginTop: 16, paddingHorizontal: 20 }}>
              {isLoadingHint && (
                <BouncingDots size={5} />
              )}
              
              {hintError && (
                <Text 
                  style={[GlobalFontStyleSheet.textSm]} 
                  className="text-center text-red-500 dark:text-red-400 italic"
                >
                  {hintError}
                </Text>
              )}
              
              {hintExample && !isLoadingHint && (
                <Text 
                  style={[GlobalFontStyleSheet.textBase]} 
                  className="text-center text-gray-600 dark:text-gray-100 italic leading-relaxed"
                >
                  {isClozeMode ? hintExample.translation : `"${hintExample.source}"`}
                </Text>
              )}
            </View>
          )}

          {/* Show hint example on both sides when card has been flipped - only for words and phrases */}
          {hasBeenFlipped && !tags?.some(tag => tag === 'sentence') && hintExample && !isClozeMode && (
            <View style={{ marginTop: 16, paddingHorizontal: 20 }}>
              <View className="border-t  border-gray-100   p-4 mb-4">
                <Text 
                  style={[GlobalFontStyleSheet.textBase, { marginBottom: 8 }]} 
                  className="text-center text-gray-800 dark:text-gray-100 pt-6 font-medium"
                >
                  "{hintExample.source}"
                </Text>
                <Text 
                  style={[GlobalFontStyleSheet.textSm]} 
                  className="text-center text-gray-600 dark:text-gray-200"
                >
                  {hintExample.translation}
                </Text>

              </View>
              
              
            </View>
          )}
          
          {/* iOS inline blur overlay */}
          {isListenMode && !isBack && hideWord && !isFlipped && !hasBeenFlipped && !isAndroid && (
            <Animated.View 
              style={[
                styles.blurContainer,
                { 
                  top: -20,
                  bottom: -20,
                  left: -30,
                  right: -30,
                  borderRadius: 15,
                  opacity: blurFadeAnim,
                  zIndex: 999,
                }
              ]}
            >
              <TouchableWithoutFeedback 
                onPress={() => {
                  console.log('iOS blur overlay touched');
                  onRevealWord();
                }}
              >
                <BlurView 
                  intensity={colorScheme.get() === "dark" ? 50 : 30}
                  style={StyleSheet.absoluteFill}
                />
              </TouchableWithoutFeedback>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      <Animated.View 
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: messageFadeIn,
          transform: [{ scale: messageFadeIn }]
        }}
      >
        <Animated.Text
          style={[
            GlobalFontStyleSheet.text2Xl,
            { 
              fontSize: hasBeenFlippedRef.current ? 32 : 24,
              fontWeight: '700',
              color: hasBeenFlippedRef.current 
                ? messageColorInterpolation 
                : SWIPE_COLORS.default,
              textAlign: 'center',
              paddingTop: 10
            }
          ]}
        >
          {currentMessage}
        </Animated.Text>
      </Animated.View>
      

      {isListenMode && !isBack && hideWord && !isFlipped && !hasBeenFlipped && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onRevealWord();
          }}
          style={styles.revealButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesomeIcon
            icon={faEye}
            size={18}
            color={colorScheme.get() === "dark" ? "#ffffff" : "#1f2937"}
          />
        </TouchableOpacity>
      )}

      {!hideAudio && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onPlayAudio();
          }}
          style={styles.audioButton}
        >
          <FontAwesomeIcon
            icon={faVolumeHigh}
            size={32}
            color={colorScheme.get() === "dark" ? "#ffffff" : "#3D4752"}
          />
        </TouchableOpacity>
      )}

      {/* Show action buttons when card is flipped, regardless of side */}
      {hasBeenFlipped && renderActionButtons()}

      {/* Show hint button when card is not flipped and hints are enabled */}
      {renderHintButton()}

      {/* Save hint button - positioned at card level to avoid touch conflicts */}
      {hasBeenFlipped && !tags?.some(tag => tag === 'sentence') && hintExample && onSaveHint && !isClozeMode && (
        <Animated.View
          style={[
            styles.saveHintButton,
            {
              transform: [{ scale: saveHintScale }],
            }
          ]}
        >
          <TouchableOpacity
            onPress={handleSaveHint}
            style={[
              styles.saveHintButtonTouch,
              {
                backgroundColor: isHintSaved ? '#10B981' : '#F87171',
              }
            ]}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            activeOpacity={0.7}
          >
            <FontAwesomeIcon
              icon={isHintSaved ? faCheck : faPlus}
              size={14}
              color="white"
            />
          </TouchableOpacity>
        </Animated.View>
      )}

        {/* User guess display */}
        {isBack && userGuess && (
          <View style={styles.guessContainer}>
            <View style={styles.guessHeader}>
              {isEvaluating ? (
                <View style={styles.loadingContainer}>
                  <BouncingDots size={10} />
                </View>
              ) : evaluation ? (
                <View style={styles.verdictContainer}>
                  <View style={[
                    styles.verdictBadge,
                    { 
                      backgroundColor: evaluation.verdict === 'correct' ? "rgba(76, 175, 80, 0.1)" : 
                                     evaluation.verdict === 'borderline' ? "rgba(255, 167, 38, 0.1)" : 
                                     "rgba(255, 167, 38, 0.1)",
                      borderColor: evaluation.verdict === 'correct' ? "#4CAF50" : 
                                 evaluation.verdict === 'borderline' ? "#FFA726" : 
                                 "#FFA726",
                    }
                  ]}>
                    <Text 
                      style={[
                        GlobalFontStyleSheet.textXl,
                        styles.verdictText,
                        { 
                          color: evaluation.verdict === 'correct' ? "#4CAF50" : 
                                evaluation.verdict === 'borderline' ? "#FFA726" : 
                                "#FFA726",
                        }
                      ]}
                    >
                      {evaluation.verdict === 'correct' ? "Great job!" :
                       evaluation.verdict === 'borderline' ? "Almost there!" :
                       "Not quite!"}
                    </Text>
                  </View>

                  {evaluation.verdict !== 'correct' && (
                    <TouchableOpacity 
                      onPress={() => setShowExplanationModal(true)}
                      style={styles.seeWhyButton}
                    >
                      <Text style={styles.seeWhyText}>see why</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        )}
    </Animated.View>
  );

  return (
    <View style={[styles.container, style]}>
      <Animated.View 
        style={[styles.card, frontAnimatedStyle]} 
        {...panResponder.panHandlers}
      >
        <TouchableWithoutFeedback onPress={(e) => handleTap(e)} disabled={isExiting}>
          {renderCardContent(frontContent, false)}
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View 
        style={[styles.card, backAnimatedStyle]}
        {...panResponder.panHandlers}
      >
        <TouchableWithoutFeedback onPress={(e) => handleTap(e)} disabled={isExiting}>
          {renderCardContent(backContent, true)}
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Add VocabModal */}
      {showVocabModal && (
        <VocabModal
          visible={showVocabModal}
          onClose={() => setShowVocabModal(false)}
          flashcard={{
            id,
            front: originalFront ?? frontContent,
            back: originalBack ?? backContent,
            language,
            tags: tags,
            flashcard_type: isWord ? 'word' : 'sentence',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }}
          flashcardService={flashcardService}
          onDelete={onDelete ? () => onDelete() : () => {}}
          audioPlayer={new AudioPlayerService()}
          onUpdateTags={onUpdateTags}
          onUpdateTranslation={onUpdateTranslation}
          onUpdateFront={onUpdateFront}
        />
              )}

        {/* Android absolute positioned blur overlay */}
        {isListenMode && hideWord && !isFlipped && !hasBeenFlipped && isAndroid && (
          <Animated.View 
            style={[
              {
                position: 'absolute',
                top: CARD_HEIGHT * 0.33,
                left: SCREEN_WIDTH * 0.047,
                width: SCREEN_WIDTH * 0.8,
                height: CARD_HEIGHT * 0.4,
                borderRadius: 20,
                overflow: 'hidden',
                opacity: blurFadeAnim,
                zIndex: 1000,
              }
            ]}
          >
            <TouchableWithoutFeedback 
              onPress={() => {
                console.log('Android blur overlay touched');
                onRevealWord();
              }}
            >
              <View 
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: colorScheme.get() === "dark" 
                      ? 'rgba(31, 40, 51, 1)' 
                      : 'rgba(58, 71, 83, 1)',
                  }
                ]}
              />
            </TouchableWithoutFeedback>
          </Animated.View>
        )}
        
        {/* Explanation Modal */}
      <SlidingModal
        visible={showExplanationModal}
        onClose={() => setShowExplanationModal(false)}
      >
        <View style={styles.explanationModal}>
          {/* Your guess section */}
          <View style={styles.answerSection}>
            <Text style={[GlobalFontStyleSheet.textLg, styles.answerLabel]}>
              Your guess:
            </Text>
            <Text style={[GlobalFontStyleSheet.textXl, styles.answerText]}>
              {userGuess}
            </Text>
          </View>

          {/* Correct answer section */}
          <View style={styles.answerSection}>
            <Text style={[GlobalFontStyleSheet.textLg, styles.answerLabel]}>
              Answer:
            </Text>
            <Text style={[GlobalFontStyleSheet.textXl, styles.answerText]}>
              {backContent}
            </Text>
          </View>

          {/* Explanation Section */}
          <View style={styles.explanationSection}>
            <View style={styles.explanationHeader}>
              <FontAwesomeIcon 
                icon={faCircleInfo} 
                size={18} 
                color={colorScheme.get() === 'dark' ? '#93c5fd' : '#60a5fa'}
              />
              <Text 
                style={[
                  GlobalFontStyleSheet.textMd,
                  styles.explanationTitle
                ]}
              >
                Explanation
              </Text>
            </View>
            <Text style={[GlobalFontStyleSheet.textBase, styles.explanationText]}>
              {evaluation?.explanation}
            </Text>
          </View>

          {/* Guidance footer */}
          <Text style={[GlobalFontStyleSheet.textSm, styles.guidanceText]}>
            Your answer was marked incorrect, so you'll need to swipe left to mark the card as not learned.
            {"\n\n"}
            But if you were close enough or the AI did not hear you correctly, you can swipe down for 'guessed correctly', or right if you knew it.
          </Text>
        </View>
      </SlidingModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: CARD_HEIGHT,
    position: "relative",
    alignItems: "center",
  },
  card: {
    width: SCREEN_WIDTH * 0.85,
    height: CARD_HEIGHT,
    backfaceVisibility: "hidden",
  },
  cardContent: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colorScheme.get() === "dark" ? 0.4 : 0.25,
    shadowRadius: 4,
    elevation: 5,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    borderWidth: 0,
    borderColor: SWIPE_COLORS.default,
  },
  audioButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurContainer: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  actionButtonsContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guessContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    padding: 10,
    borderRadius: 8,
  },
  guessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evaluationContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  loadingContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  verdictContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  verdictBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  verdictText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  explanationContainer: {
    width: '100%',
    borderRadius: 12,
    gap: 8,
  },
  explanationText: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
    color: colorScheme.get() === 'dark' ? '#F0F6FC' : '#111827',
  },
  encouragementText: {
    textAlign: 'center',
    color: '#FFA726',
    marginTop: 4,
    fontSize: 12,
  },
  seeWhyButton: {
    marginTop: 8,
  },
  seeWhyText: {
    padding: 10,
    color: colorScheme.get() === 'dark' ? '#F0F6FC' : '#6B7280',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  explanationModal: {
    padding: 12,
  },
  answerSection: {
    marginBottom: 12,
  },
  answerLabel: {
    color: colorScheme.get() === 'dark' ? '#9CA3AF' : '#6B7280',
    marginBottom: 4,
  },
  answerText: {
    color: colorScheme.get() === 'dark' ? '#F3F4F6' : '#111827',
    fontWeight: '600',
    paddingBottom: 12,
  },
  explanationSection: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: colorScheme.get() === 'dark' ? 'rgba(146, 197, 253, 0.1)' : '#F3F4F6',
    marginVertical: 24,
    marginHorizontal: -12,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  explanationTitle: {
    marginLeft: 8,
    fontWeight: '600',
    color: colorScheme.get() === 'dark' ? '#F3F4F6' : '#111827',
  },
  guidanceText: {
    color: colorScheme.get() === 'dark' ? '#9CA3AF' : '#6B7280',
    lineHeight: 20,
    fontSize: 13,
  },
  hintButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  saveHintButton: {
    position: "absolute",
    bottom: 120, // Position it over the hint area
    alignSelf: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  saveHintButtonTouch: {
    borderRadius: 24,
    width: 32,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 
