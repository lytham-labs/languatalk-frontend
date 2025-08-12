import { Animated, Platform } from 'react-native';

class SentenceAnimationService {
    private wordAnimations: Animated.Value[] = [];
    private wordTimings: any = null;
    private isAndroid: boolean = Platform.OS === 'android';
    private currentChatMessageId: string | null = null;
    private currentSentenceIndices: number[] = [];
    private fullText: string = '';
    private wordToSentenceIndex: number[] = []; // Maps wordTiming index to sentence index
    private sentences: { startIndex: number; endIndex: number }[] = []; // Stores start and end indices of words in each sentence

    initializeAnimations(wordTimings: any, chatMessageId: string, isSlowAudio: boolean = false, fullText: string) {
      this.wordTimings = isSlowAudio ? this.adjustWordTimingsForSlowAudio(wordTimings) : wordTimings;
      this.currentChatMessageId = chatMessageId;
      this.fullText = fullText;
      this.initializeWordAnimations(this.wordTimings.word_start_times_ms.length);
      this.preprocessFullText(); // Preprocess the full text
  }

    private initializeWordAnimations(count: number) {
        this.wordAnimations = Array(count).fill(0).map(() => new Animated.Value(0));
    }

    private preprocessFullText() {
      // Split fullText into sentences using punctuation that ends sentences
      const sentenceEndRegex = /[.!?。！？។៕။…\u3002\uFF01\uFF1F\u0964\u0965]/g;
      const sentences = this.fullText.split(sentenceEndRegex).filter(s => s.trim() !== '');
  
      // Re-split fullText to get sentence delimiters
      const sentenceDelimiters = this.fullText.match(sentenceEndRegex) || [];

  
      // Reconstruct sentences with delimiters
      for (let i = 0; i < sentences.length; i++) {
          sentences[i] = sentences[i].trim();
          if (sentenceDelimiters[i]) {
              sentences[i] += sentenceDelimiters[i];
          }
      }
  
      // Build a flat array of words from all sentences, including punctuation
      const wordRegex = /[\wáéíóúüñÁÉÍÓÚÜÑ']+|[.,!?;:"""''()]/g; // Adjust regex to match words and punctuation
  
      this.wordToTextWordIndex = []; // Reset mappings
      this.wordToSentenceIndex = [];
      this.sentences = [];
  
      let wordTimingIndex = 0;
      let textWordIndex = 0;
  
      for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
          const sentence = sentences[sentenceIndex];
          const sentenceWords = sentence.match(wordRegex) || [];
          
          const sentenceStartIndex = wordTimingIndex;
  
          for (let i = 0; i < sentenceWords.length; i++) {
              const textWord = sentenceWords[i];
              const cleanTextWord = this.cleanWordForComparison(textWord);
  
              if (!cleanTextWord) {
                  textWordIndex++;
                  continue;
              }
  
              // Modified matching logic
              let foundMatch = false;
              const startSearchIndex = wordTimingIndex;
              const searchLimit = Math.min(startSearchIndex + 5, this.wordTimings.words.length); // Limit search range
  
              for (let searchIndex = startSearchIndex; searchIndex < searchLimit; searchIndex++) {
                  const timingWord = this.cleanWordForComparison(this.wordTimings.words[searchIndex]);
  
                  if (timingWord === cleanTextWord) {
                      this.wordToSentenceIndex[searchIndex] = sentenceIndex;
                      wordTimingIndex = searchIndex + 1;
                      textWordIndex++;
                      foundMatch = true;
                      break;
                  }
              }
  
              if (!foundMatch) {
                  textWordIndex++;
              }
          }
  
          const sentenceEndIndex = wordTimingIndex - 1;
          this.sentences[sentenceIndex] = { startIndex: sentenceStartIndex, endIndex: sentenceEndIndex };
      }
  }

  private cleanWordForComparison(word: string): string {
    return word.toLowerCase()
        .replace(/[áéíóúüñ]/g, '') // Remove accented characters and ñ since they are not in the wordTimings
        .replace(/[^a-z0-9']/g, ''); // Remove any non-alphanumeric characters except apostrophes
  }

  startHighlighting(currentTime: number) {
    if (this.isAndroid || !this.wordTimings || !this.wordAnimations.length) return;

    // Find the current word being spoken
    const activeWordIndex = this.wordTimings.word_start_times_ms.findIndex((startTime: number, index: number) => {
        const endTime = startTime + this.wordTimings.word_durations_ms[index];
        return currentTime >= startTime && currentTime < endTime;
    });

    if (activeWordIndex === -1) {
        this.wordAnimations.forEach(animation => animation.setValue(0));
        this.currentSentenceIndices = [];
        return;
    }

    // Get the sentence index for the active word
    const sentenceIndex = this.wordToSentenceIndex[activeWordIndex];

    if (sentenceIndex === undefined) {
        this.currentSentenceIndices = [];
        return;
    }

    // Get all word indices in the current sentence
    const sentence = this.sentences[sentenceIndex];
    const newSentenceIndices = [];
    for (let i = sentence.startIndex; i <= sentence.endIndex; i++) {
        newSentenceIndices.push(i);
    }

    // Check if we've moved to a new sentence
    const isSameSentence = this.arraysEqual(this.currentSentenceIndices, newSentenceIndices);

    if (!isSameSentence) {
        // Reset previous sentence animations
        this.currentSentenceIndices.forEach(index => {
            if (!newSentenceIndices.includes(index)) {
                this.wordAnimations[index].setValue(0);
            }
        });

        // Set animations for new sentence
        newSentenceIndices.forEach(index => {
            if (index >= 0 && index < this.wordAnimations.length) {
                Animated.timing(this.wordAnimations[index], {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }).start();
            }
        });

        this.currentSentenceIndices = newSentenceIndices;
    }
  }

    stopHighlighting() {
      this.wordAnimations.forEach(animation => animation.setValue(0));
      this.currentSentenceIndices = [];
    }

    getWordAnimation(index: number, chatMessageId: string, text: string): Animated.Value {
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

    private arraysEqual(a: number[], b: number[]): boolean {
      if (a.length !== b.length) return false;
      return a.every((val, index) => val === b[index]);
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

export default SentenceAnimationService;
