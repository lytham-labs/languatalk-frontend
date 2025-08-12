import { Animated, Platform } from 'react-native';

class WordAnimationService {
    private wordAnimations: Animated.Value[] = [];
    private wordTimings: any = null;
    private animationInterval: NodeJS.Timeout | null = null;
    private isPlaying: boolean = false;
    private isAndroid: boolean = Platform.OS === 'android';
    private currentChatMessageId: string | null = null;

    initializeAnimations(wordTimings: any, chatMessageId: string, isSlowAudio: boolean = false, text: string) {
        this.wordTimings = isSlowAudio ? this.adjustWordTimingsForSlowAudio(wordTimings) : wordTimings;
        this.currentChatMessageId = chatMessageId;
        this.initializeWordAnimations(this.wordTimings.word_start_times_ms.length);
    }

    private initializeWordAnimations(count: number) {
        this.wordAnimations = Array(count).fill(0).map(() => new Animated.Value(0));
    }

    startHighlighting(currentTime: number) {
        if (this.isAndroid || !this.wordTimings || !this.wordAnimations.length) return;

        this.wordTimings.word_start_times_ms.forEach((startTime: number, index: number) => {
            const endTime = startTime + this.wordTimings.word_durations_ms[index];
            const isActive = currentTime >= startTime && currentTime < endTime;
            Animated.timing(this.wordAnimations[index], {
                toValue: isActive ? 1 : 0,
                duration: 50,
                useNativeDriver: true,
            }).start();
        });
    }

    stopHighlighting() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        this.wordAnimations.forEach(animation => animation.setValue(0));
    }

    getWordAnimation(index: number, chatMessageId: string): Animated.Value {
        if (this.isAndroid) {
            return new Animated.Value(0);
        }

        if (chatMessageId !== this.currentChatMessageId) {
            return new Animated.Value(0);
        }

        if (index < 0 || index >= this.wordAnimations.length) {
            return new Animated.Value(0);
        }

        return this.wordAnimations[index];
    }

    private adjustWordTimingsForSlowAudio(originalTimings: any) {
        const slowFactor = 1 / 0.75;
        return {
            words: originalTimings.words,
            word_start_times_ms: originalTimings.word_start_times_ms.map((time: number) => time * slowFactor),
            word_durations_ms: originalTimings.word_durations_ms.map((duration: number) => duration * slowFactor)
        };
    }
}

export default WordAnimationService;
