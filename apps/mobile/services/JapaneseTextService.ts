import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Segment, PressableSegment } from '@/types/chat';
import Kuroshiro from '../lib/kuroshiro-core';
import kuromoji from "@charlescoeder/react-native-kuromoji";
import Analyzer from '../lib/kuroshiro-analyzer-kuromoji';
import * as utils from '../lib/kuroshiro-util';

export interface KUROMOJI_TOKEN {
    word_id: number;
    word_type: "KNOWN" | "UNKNOWN" | "BOS" | "EOS";
    word_position: number;
    surface_form: string | Uint8Array;
    pos: string;
    pos_detail_1: string;
    pos_detail_2: string;
    pos_detail_3: string;
    conjugated_type: string;
    conjugated_form: string;
    basic_form: string;
    reading?: string;
    pronunciation?: string;
}

// load assets: copy 'dict' folder to your assets folder
const assets = {
    "base.dat.gz": Asset.fromModule(
    require("../assets/dict/base.dat.gz")
    ),
    "cc.dat.gz": Asset.fromModule(require("../assets/dict/cc.dat.gz")),
    "check.dat.gz": Asset.fromModule(
    require("../assets/dict/check.dat.gz")
    ),
    "tid.dat.gz": Asset.fromModule(require("../assets/dict/tid.dat.gz")),
    "tid_map.dat.gz": Asset.fromModule(
    require("../assets/dict/tid_map.dat.gz")
    ),
    "tid_pos.dat.gz": Asset.fromModule(
    require("../assets/dict/tid_pos.dat.gz")
    ),
    "unk.dat.gz": Asset.fromModule(require("../assets/dict/unk.dat.gz")),
    "unk_char.dat.gz": Asset.fromModule(
    require("../assets/dict/unk_char.dat.gz")
    ),
    "unk_compat.dat.gz": Asset.fromModule(
    require("../assets/dict/unk_compat.dat.gz")
    ),
    "unk_invoke.dat.gz": Asset.fromModule(
    require("../assets/dict/unk_invoke.dat.gz")
    ),
    "unk_map.dat.gz": Asset.fromModule(
    require("../assets/dict/unk_map.dat.gz")
    ),
    "unk_pos.dat.gz": Asset.fromModule(
    require("../assets/dict/unk_pos.dat.gz")
    ),
};

export interface TextService {
  processText(text: string, shouldCreateReadingAids: boolean, shouldProcessBolding: boolean): Promise<PressableSegment[]>;
  isServiceLanguage(text: string): boolean;
}

const groupSpecialCharacters = (segments: string[]): string[] => {
    const specialChars = ['(', ')', '"', '"', ',', ':', '。', '、', '，', '：', '；', '？', '！', '．']
    const result: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
        const current = segments[i];
        const next = i < segments.length - 1 ? segments[i + 1] : '';
        
        // Skip if this segment is whitespace
        if (/^\s*$/.test(current)) {
            result.push(current);
            continue;
        }
        
        let groupedSegment = current;
        
        // Check if we should merge with previous special character
        if (result.length > 0 && specialChars.includes(result[result.length - 1]) && !(/^\s*$/.test(current))) {
            groupedSegment = result.pop() + current;
        }
        
        // Check if we should merge with next special character
        if (next && specialChars.includes(next) && !(/^\s*$/.test(current))) {
            groupedSegment = groupedSegment + next;
            i++; // Skip the next segment since we've consumed it
        }
        
        result.push(groupedSegment);
    }
    
    return result;
};

class JapaneseTextService implements TextService {
  private static instance: JapaneseTextService | null = null;
  private kuroshiro: Kuroshiro;
  private isKuroshiroInitialized: boolean = false;
  private tokenizer: any = null;
  readyPromise: Promise<void>;
  private initializationComplete = false;

  // Private constructor prevents direct instantiation
  private constructor() {
    this.kuroshiro = new Kuroshiro();
    this.readyPromise = this.initialize();
  }

  // Static method to get the instance
  public static getInstance(): JapaneseTextService {
    if (!JapaneseTextService.instance) {
      console.log('Creating new JapaneseTextService instance');
      JapaneseTextService.instance = new JapaneseTextService();
    }
    return JapaneseTextService.instance;
  }

  public isServiceLanguage(text: string): boolean {
    return utils.hasJapanese(text);
  }

  private initializeKuroshiro = async () => {
    try {
      console.log('FUNCTION: initializeKuroshiro ');
      await this.kuroshiro.init(new Analyzer({assets}));
      console.log('Kuroshiro initialized with Analyzer and assets');
      this.isKuroshiroInitialized = true;
      console.log('Kuroshiro initialized', this.isKuroshiroInitialized);
    } catch (error) {
      console.error("Error initializing Kuroshiro:", error);
    }
  };

  // Flagged feature to segment text into characters
  async createSegments(text: string) {
    // For English text, use word-based splitting to preserve contractions
    if (!utils.hasJapanese(text)) {
      return text.split(/\s+/).filter(word => word.length > 0);
    }
    
    await this.ensureTokenizerReady();
    const tokens = this.tokenizer.tokenize(text);

    if (!tokens || !Array.isArray(tokens)) {
      console.error('Invalid tokens result:', tokens);
      // Use word-based splitting instead of character-based splitting for better contraction handling
      return text.split(/\s+/).filter(word => word.length > 0);
    }
    
    // Convert any Uint8Array values to strings
    const segmentedCharacters = tokens.map((token: KUROMOJI_TOKEN) => {

      // FUTURE USE:  the segments return an array of objects, we need to return an array of strings.
      // the objects contain the surface_form, base_form, reading, and pronunciation.
      // we need to return an array of strings, so we are returning the surface_form,
      // but could return the reading or pronunciation as well if needed to get better audio.

      const surface = token.surface_form;
      // Handle Uint8Array by converting to string
      return typeof surface === 'string' 
        ? surface 
        : new TextDecoder().decode(surface);
    });
    return segmentedCharacters;
  }

  async processText(text: string, shouldCreateReadingAids = true, shouldProcessBolding = false): Promise<PressableSegment[]> {
    // Wait for initialization to complete
    await this.readyPromise;

    // Trim text to remove non-word space characters, the text still has spaces between words.
    const trimmedText = text.replace(/[\s\u200B\u200C\u200D\u2060\uFEFF]+/g, ' ').trim();

    let segments = [text];

    // Handle bold processing if enabled
    let boldRanges: Array<{start: number, end: number}> = [];
    let cleanText = trimmedText;
    
    if (shouldProcessBolding) {
      const { cleanedText, boldRanges: ranges } = this.extractBoldRanges(trimmedText);
      cleanText = cleanedText;
      boldRanges = ranges;
    }

    // Try to segment, but with fallback
    try {
      segments = await this.createSegments(cleanText);
    } catch (segmentError) {
      console.warn("Segmentation failed, using fallback:", segmentError);
      // Use word-based splitting instead of character-based splitting for better contraction handling
      segments = cleanText.split(/\s+/).filter(word => word.length > 0);
    }
    
    // Only apply groupSpecialCharacters for Japanese text to avoid interfering with English contractions
    if (utils.hasJapanese(cleanText)) {
      segments = groupSpecialCharacters(segments);
    }
    
    if (!utils.hasJapanese(cleanText)) {
      return this.processSegmentWithoutReadingAids(segments, shouldProcessBolding);
    }
    
    // Create a mapping of character positions to check bold status
    const charToSegmentMap = this.createCharToSegmentMap(segments);
    
    const processedSegments = await Promise.all(segments.map((segment, segmentIndex) => 
      this.processSegment(segment, segmentIndex, charToSegmentMap, boldRanges)
    ));
    console.log("********** processedSegments: ", processedSegments);
    return processedSegments;
  }

  processSegmentWithoutReadingAids(segments: string[], shouldProcessBolding = false): PressableSegment[] {
    return segments.map(segment => {
      const cleanText = shouldProcessBolding ? segment.replace(/\*/g, '') : segment;
      const isBold = shouldProcessBolding ? /\*[^*]+\*/.test(segment) : false;

      console.log("********** segment: ", segment);
      return {
        text: cleanText,
        type: 'plain' as const,
        segments: [{baseText: cleanText, isBold: isBold}],
        isBold: isBold
      };
  });
  }

  // Create a mapping of character positions to segment indices
  private createCharToSegmentMap(segments: string[]): Map<number, number> {
    const charToSegmentMap = new Map<number, number>();
    let charIndex = 0;
    
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      for (let i = 0; i < segment.length; i++) {
        charToSegmentMap.set(charIndex + i, segmentIndex);
      }
      charIndex += segment.length;
    }
    
    return charToSegmentMap;
  }

  async processSegment(segment: string, segmentIndex: number, charToSegmentMap: Map<number, number>, boldRanges: Array<{start: number, end: number}>): Promise<PressableSegment> {
    try {
      // Check if any character in this segment should be bold
      let isBold = false;
      
      // Find the character positions that belong to this segment
      for (const [charPos, segIndex] of charToSegmentMap.entries()) {
        if (segIndex === segmentIndex && boldRanges.some(range => charPos >= range.start && charPos < range.end)) {
          isBold = true;
          break;
        }
      }
      
      if (utils.hasJapanese(segment)) {
        const result = await this.kuroshiro.convert(segment, { mode: 'furigana', to: "all" });
        // Add isBold property to the result
        return {
          ...result,
          isBold: isBold
        };
      } else {
        return {
          type: 'plain', 
          text: segment, 
          segments: [{baseText: segment}],
          isBold: isBold
        };
      }
    } catch (error) {
      console.error("Error during conversion:", error);
      return {
        type: 'plain',
        text: segment, 
        segments: [{baseText: segment}],
        isBold: false
      };
    }
  }

  // New method to extract bold ranges from text
  private extractBoldRanges(text: string): { cleanedText: string, boldRanges: Array<{start: number, end: number}> } {
    const boldRanges: Array<{start: number, end: number}> = [];
    let cleanedText = '';
    let charIndex = 0;
    let isInBoldSection = false;
    let boldStartIndex = -1;
    
    // First, convert HTML bold tags to asterisk format
    let processedText = text.replace(/<b>([^<]+)<\/b>/g, (_, phrase) => {
      return phrase.split(' ').map((word: string) => `*${word}*`).join(' ');
    });
    
    for (let i = 0; i < processedText.length; i++) {
      const char = processedText[i];
      
      if (char === '*') {
        if (!isInBoldSection) {
          // Start of bold section
          isInBoldSection = true;
          boldStartIndex = charIndex;
        } else {
          // End of bold section - mark the range as bold
          isInBoldSection = false;
          
          // Add the bold range
          boldRanges.push({ start: boldStartIndex, end: charIndex });
        }
        // Don't add the asterisk to cleaned text
        continue;
      }
      
      // Add the character to cleaned text
      cleanedText += char;
      charIndex++;
    }
    
    return { cleanedText, boldRanges };
  }

  private async initialize(): Promise<void> {
    if (this.initializationComplete) {
      return; // Already initialized
    }
    
    try {
      console.log("Starting initialization of Japanese text service...");
      
      // Create a Promise for kuromoji initialization
      const kuromijiPromise = new Promise<void>((resolve, reject) => {
        kuromoji
          .builder({ assets })
          .build((err: Error | null, tokenizer: any) => {
            if (err) {
              console.error("kuromoji error:", err);
              reject(err);
            } else {
              console.log("tokenizer loaded successfully");
              this.tokenizer = tokenizer;
              resolve();
            }
          });
      });

      // Initialize Kuroshiro
      const kuroshiroPromise = this.initializeKuroshiro();

      // Wait for BOTH to complete before continuing
      await Promise.all([kuroshiroPromise, kuromijiPromise]);
      
      console.log("Both Kuroshiro and tokenizer are fully initialized");
    } catch (error) {
      console.error("Initialization error:", error);
      // DON'T throw here - we'll handle errors in the calling methods
    }
  }

  // Improved ensureTokenizerReady with retry logic
  private async ensureTokenizerReady(): Promise<void> {
    const maxAttempts = 3;
    let attempts = 0;
    
    while (!this.tokenizer && attempts < maxAttempts) {
      console.log(`Waiting for tokenizer (attempt ${attempts + 1}/${maxAttempts})...`);
      
      if (attempts === 0) {
        // First attempt - wait for the promise
        try {
          await this.readyPromise;
        } catch (error) {
          console.error("Error waiting for initialization:", error);
        }
      } else {
        // Subsequent attempts - add some delay and reinitialize
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await this.initialize();
        } catch (error) {
          console.error(`Retry initialization attempt ${attempts} failed:`, error);
        }
      }
      
      attempts++;
    }
    
    if (!this.tokenizer) {
      throw new Error("Tokenizer failed to initialize after multiple attempts");
    }
  }

  // Add a static method to check initialization status
  public static isInitialized(): boolean {
    return !!JapaneseTextService.instance?.initializationComplete;
  }

  // Add method to explicitly wait for initialization
  public static async waitForInitialization(): Promise<void> {
    if (!JapaneseTextService.instance) {
      JapaneseTextService.getInstance(); // Create the instance if it doesn't exist
    }
    
    if (!JapaneseTextService.instance?.initializationComplete) {
      await JapaneseTextService.instance?.readyPromise;
    }
  }

  // Test method to verify bold processing with different scenarios
  async testBoldProcessing(): Promise<void> {
    console.log('Testing bold processing with different scenarios...');
    
    const testCases = [
      {
        name: "Single character bold (asterisk)",
        text: "*楽*しみにしています。",
        expectedBold: "楽"
      },
      {
        name: "Multiple characters bold (asterisk)",
        text: "*楽し*みにしています。",
        expectedBold: "楽し"
      },
      {
        name: "Cross-segment bold (asterisk)",
        text: "*楽しみに*しています。",
        expectedBold: "楽しみに"
      },
      {
        name: "Multiple bold sections (asterisk)",
        text: "*楽*しみに*して*います。",
        expectedBold: ["楽", "して"]
      },
      {
        name: "HTML bold tags - single word",
        text: "This is <b>bold</b> text",
        expectedBold: "bold"
      },
      {
        name: "HTML bold tags - multiple words",
        text: "Say <b>hello world</b> to everyone",
        expectedBold: ["hello", "world"]
      },
      {
        name: "Mixed HTML and asterisk",
        text: "Mix <b>bold tags</b> and *asterisks*",
        expectedBold: ["bold", "tags", "asterisks"]
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n--- Testing: ${testCase.name} ---`);
      console.log('Input text:', testCase.text);
      
      const { cleanedText, boldRanges } = this.extractBoldRanges(testCase.text);
      console.log('Cleaned text:', cleanedText);
      console.log('Bold ranges:', boldRanges);
      
      const result = await this.processText(testCase.text, true, true);
      console.log('Result segments:', result.map(seg => ({ text: seg.text, isBold: seg.isBold })));
      
      // Verify bold segments
      if (Array.isArray(testCase.expectedBold)) {
        for (const expectedText of testCase.expectedBold) {
          const boldSegment = result.find(segment => segment.text === expectedText);
          if (boldSegment && boldSegment.isBold) {
            console.log(`✓ "${expectedText}" is correctly marked as bold`);
          } else {
            console.log(`✗ "${expectedText}" is NOT marked as bold`);
          }
        }
      } else {
        const boldSegment = result.find(segment => segment.text === testCase.expectedBold);
        if (boldSegment && boldSegment.isBold) {
          console.log(`✓ "${testCase.expectedBold}" is correctly marked as bold`);
        } else {
          console.log(`✗ "${testCase.expectedBold}" is NOT marked as bold`);
        }
      }
    }
  }

}

// Export a function to get the instance, not the instance itself
export default function getJapaneseTextService(): JapaneseTextService {
  return JapaneseTextService.getInstance();
}

