import { Message, ProcessedMessage, Line, PressableSegment, FormattingState, Segment } from '@/types/chat';

// Interface for tracking formatting state at character level
interface CharacterFormatting {
  char: string;
  formatting: FormattingState;
}

// Interface for parsed text with formatting information
interface ParsedTextWithFormatting {
  cleanText: string;
  characterFormatting: CharacterFormatting[];
}

const isRTLText = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(text);
};

export const isPunctuation = (text: string): boolean => {
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(text);
};

// Parse HTML tags and track formatting state for each character
function parseHtmlTags(text: string): ParsedTextWithFormatting {
  const characterFormatting: CharacterFormatting[] = [];
  let cleanText = '';
  let currentFormatting: FormattingState = {};
  
  // Stack to track nested tags
  const tagStack: string[] = [];
  
  // Regular expression to match HTML tags
  const tagRegex = /<\/?([a-z]+)(?:\s[^>]*)?>/gi;
  
  let lastIndex = 0;
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosingTag = fullTag.startsWith('</');
    const startIndex = match.index;
    
    // Add characters before the tag
    for (let i = lastIndex; i < startIndex; i++) {
      const char = text[i];
      characterFormatting.push({
        char,
        formatting: { ...currentFormatting }
      });
      cleanText += char;
    }
    
    // Handle the tag
    if (isClosingTag) {
      // Remove tag from stack
      const index = tagStack.lastIndexOf(tagName);
      if (index !== -1) {
        tagStack.splice(index, 1);
      }
    } else {
      // Add tag to stack
      tagStack.push(tagName);
    }
    
    // Update current formatting based on active tags
    currentFormatting = {};
    for (const activeTag of tagStack) {
      switch (activeTag) {
        case 'b':
        case 'strong':
          currentFormatting.isBold = true;
          break;
        case 'del':
        case 's':
        case 'strike':
          currentFormatting.isDeleted = true;
          break;
        case 'i':
        case 'em':
          currentFormatting.isItalic = true;
          break;
        case 'u':
          currentFormatting.isUnderlined = true;
          break;
        // Add more cases as needed
      }
    }
    
    lastIndex = startIndex + fullTag.length;
  }
  
  // Add remaining characters after the last tag
  for (let i = lastIndex; i < text.length; i++) {
    const char = text[i];
    characterFormatting.push({
      char,
      formatting: { ...currentFormatting }
    });
    cleanText += char;
  }
  
  return { cleanText, characterFormatting };
}

// Get formatting state for a text segment based on character formatting
function getFormattingForSegment(
  segmentText: string, 
  characterFormatting: CharacterFormatting[], 
  startIndex: number
): FormattingState {
  if (!segmentText || segmentText.length === 0) {
    return {};
  }
  
  // Check all characters in the segment for formatting
  const combinedFormatting: FormattingState = {};
  
  for (let i = 0; i < segmentText.length; i++) {
    const charIndex = startIndex + i;
    if (charIndex < characterFormatting.length) {
      const charFormatting = characterFormatting[charIndex].formatting;
      // Combine formatting - if any character has a formatting property, the segment should have it
      if (charFormatting.isBold) combinedFormatting.isBold = true;
      if (charFormatting.isDeleted) combinedFormatting.isDeleted = true;
      if (charFormatting.isItalic) combinedFormatting.isItalic = true;
      if (charFormatting.isUnderlined) combinedFormatting.isUnderlined = true;
    }
  }
  
  return combinedFormatting;
}

// Apply formatting to segments within a pressable segment
function applyFormattingToSegments(
  segments: any[], 
  characterFormatting: CharacterFormatting[], 
  globalCharIndex: number
): any[] {
  return segments.map((segment, segmentIndex) => {
    const formatting = getFormattingForSegment(segment.baseText, characterFormatting, globalCharIndex);
    return {
      ...segment,
      formatting
    };
  });
}

// Function to split text into words while preserving contractions
const splitTextIntoWords = (text: string): string[] => {
  // Split on spaces but preserve contractions
  const words = text.split(/\s+/);
  const result: string[] = [];
  
  for (const word of words) {
    if (!word) continue;
    
    // Check if this word contains a contraction (apostrophe)
    if (word.includes("'")) {
      // Keep the entire contraction as one word
      result.push(word);
    } else {
      result.push(word);
    }
  }
  
  return result;
};

const groupSpecialCharacters = (segments: string[]): string[] => {
    const specialChars = ['(', ')', '"', '"', ',', ':', '。', '、', '，', '：', '；', '？', '！', '．']
    const result: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const current = segments[i];
      const prev = i > 0 ? segments[i - 1] : '';
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

// for use with Translation and Vocab Text
export const processTextSegments = (text: string, readingAidService: any) => {
  if (readingAidService) {
    console.log('******textProcessingUtils******  processing with readingAidService: ');
    return readingAidService.processText(text, true, false);
  }
  return text;
};

export async function processGenericContent(language: string | undefined, textContent: string, readingAidService: any | null): Promise<Partial<ProcessedMessage>> {
  
  // Parse HTML tags and get formatting information first
  const { cleanText, characterFormatting } = parseHtmlTags(textContent);
  
  // Handle empty text
  if (!cleanText.trim()) {
    return {
      content: cleanText,
      lines: [],
      messageSegmentTextArray: [],
      processed_at: new Date().toISOString(),
    };
  }
  
  // Split content into lines
  let lines = cleanText.split('\n');
  let content = cleanText;
  if (isRTLText(content)) {
    lines = lines.map(line => {
      const reversedLine = line.split(' ').reverse().join(' ');
      return reversedLine;
    });
    console.log("RTL lines: ", lines)
  }

  const processedLines: Line[] = [];
  let globalCharIndex = 0; // Track character position in clean text
  
  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }
    
    const processedLine: Line = {
      text: line,
      pressableSegments: []
    };

    switch(language) {
      case 'japanese':
        try {
          if (readingAidService) {
            // console.log('********** textProcessingUtils: readingAidService');
            const segments = await readingAidService.processText(line, true, true);
            
            // Apply formatting to each pressable segment and its internal segments
            const formattedSegments = segments.map((segment: any, segmentIndex: number) => {
              const segmentFormatting = getFormattingForSegment(segment.text, characterFormatting, globalCharIndex);
              
              // Apply formatting to the internal segments
              const formattedInternalSegments = applyFormattingToSegments(
                segment.segments || [{ baseText: segment.text }], 
                characterFormatting, 
                globalCharIndex
              );
              
              // Update globalCharIndex for the next segment
              globalCharIndex += segment.text.length;
              
              return {
                ...segment,
                segments: formattedInternalSegments
              };
            });
            
            processedLine.pressableSegments = formattedSegments;
            break;
          } else {
            // console.log('********** textProcessingUtils: no readingAidService: ');
          }
        } catch (error) {
          console.error('Error processing text:', error);
        }
      // case 'chinese':
        // // Chinese text should be processed character by character, not word by word
        // const chineseSegments = groupSpecialCharacters(processedText.split('').filter(char => !(/\s/.test(char))));
        // processedLine.pressableSegments = chineseSegments.map(char => {
        //   const cleanChar = shouldProcessBolding ? char.replace(/\*/g, '') : char;
        //   const isBold = shouldProcessBolding ? /\*[^*]+\*/.test(char) : false;

        //   return {
        //     text: cleanChar,
        //     type: 'plain' as const,
        //     isBold: isBold,
        //     segments: [{
        //       baseText: cleanChar,
        //     }]
        //   }
        // });
        // break;
      default:
        const wordSegments = splitTextIntoWords(line);
        processedLine.pressableSegments = wordSegments.map((word, wordIndex) => {
          // Handle markdown asterisks for bolding
          const cleanWord = word.replace(/\*+/g, '');
          const hasMarkdownBold = /\*+[^*]+\*+/.test(word);
          
          const segmentFormatting = getFormattingForSegment(cleanWord, characterFormatting, globalCharIndex);
          const isBold = hasMarkdownBold || segmentFormatting.isBold;
          
          globalCharIndex += cleanWord.length + (wordIndex === wordSegments.length - 1 ? 0 : 1); // +1 for space
          
          return {
            text: cleanWord,
            type: 'plain' as const,
            isBold: isBold,
            segments: [{
              baseText: cleanWord,
              formatting: {
                ...segmentFormatting,
                isBold: isBold
              }
            }]
          }
        });
        break;
    }
    processedLines.push(processedLine);
    
    // Reset globalCharIndex for the next line (add 1 for newline character)
    globalCharIndex += 1;
  }

  // Create messageSegmentTextArray from all pressableSegments
  const messageSegmentTextArray: string[] = [];
  processedLines.forEach(line => {
    line.pressableSegments.forEach(segment => {
      if (segment.text.trim()) { // Only add non-empty text        messageSegmentTextArray.push(segment.text);
        //add the index to the segment
        segment.messageSegmentIndex = messageSegmentTextArray.length - 1;
      }
    });
  });

  return {
    content: cleanText,
    lines: processedLines,
    messageSegmentTextArray,
    processed_at: new Date().toISOString(),
  };
}

export async function processMessage(language: string, message: Message, role:string, readingAidService: any): Promise<ProcessedMessage> {
  if (message.role === 'assistant') {
    // Replace "*phrase*" or "**phrase**" with "*word* *word*..."
    message.content = message.content.replace(/\*+([^*]+)\*+/g, (_, phrase) => {
      return phrase.split(' ').map((word: string) => `*${word}*`).join(' ');
    });
  }

  // Parse HTML tags and get formatting information
  const { cleanText, characterFormatting } = parseHtmlTags(message.content);

  // Split content into lines
  let lines = cleanText.split('\n');
  let content = cleanText;
  if (isRTLText(content)) {
    lines = lines.map(line => {
      const reversedLine = line.split(' ').reverse().join(' ');
      return reversedLine;
    });
    console.log("RTL lines: ", lines)
  }

  const processedLines: Line[] = [];
  let globalCharIndex = 0; // Track character position in clean text
  
  for (const line of lines) {
    const processedLine: Line = {
      text: line,
      pressableSegments: []
    };
    const shouldProcessBolding = role === 'assistant';

    switch(language) {
      case 'japanese':
        try {
          if (readingAidService) {
            // console.log('********** textProcessingUtils: readingAidService');
            const segments = await readingAidService.processText(line, true, shouldProcessBolding);
            // Apply formatting to each pressable segment and its internal segments
            const formattedSegments = segments.map((segment: any, segmentIndex: number) => {
              const segmentFormatting = getFormattingForSegment(segment.text, characterFormatting, globalCharIndex);
              
              // Apply formatting to the internal segments
              const formattedInternalSegments = applyFormattingToSegments(
                segment.segments || [{ baseText: segment.text }], 
                characterFormatting, 
                globalCharIndex
              );
              
              return {
                ...segment,
                segments: formattedInternalSegments
              };
            });
            
            processedLine.pressableSegments = formattedSegments;
            globalCharIndex += line.length;
            break;
          } else {
            // console.log('********** textProcessingUtils: no readingAidService: ');
          }
        } catch (error) {
          console.error('Error processing text:', error);
        }
        break;
      default:
        const wordSegments = splitTextIntoWords(line);
        processedLine.pressableSegments = wordSegments.map(word => {
          const segmentFormatting = getFormattingForSegment(word, characterFormatting, globalCharIndex);
          globalCharIndex += word.length + (word === wordSegments[wordSegments.length - 1] ? 0 : 1); // +1 for space
          
          const cleanWord = shouldProcessBolding ? word.replace(/\*/g, '') : word;
          const isBold = shouldProcessBolding ? /\*[^*]+\*/.test(word) : false;

          return {
            text: cleanWord,
            type: 'plain' as const,
            isBold: isBold || segmentFormatting.isBold,
            segments: [{
              baseText: cleanWord,
              formatting: segmentFormatting
            }]
          }
        });
        break;
    }
    processedLines.push(processedLine);
  }

  // Create messageSegmentTextArray from all pressableSegments
  const messageSegmentTextArray: string[] = [];
  processedLines.forEach(line => {
    line.pressableSegments.forEach(segment => {
      if (segment.text.trim()) { // Only add non-empty text
        messageSegmentTextArray.push(segment.text);
        //add the index to the segment
        segment.messageSegmentIndex = messageSegmentTextArray.length - 1;
      }
    });
  });

  return {
    ...message,
    content: cleanText,
    lines: processedLines,
    messageSegmentTextArray,
    processed_at: new Date().toISOString(),
  };
}

export async function processMessages(language: string, chatDataMessages: Message[] = [], readingAidService: any): Promise<ProcessedMessage[]> {
  if (!chatDataMessages?.length) return [];
  
  return Promise.all(chatDataMessages.map(message => processMessage(language, message, message.role, readingAidService)));
}

// Utility function to check if a segment has any formatting
export function hasFormatting(segment: Segment): boolean {
  if (!segment.formatting) return false;
  return Object.values(segment.formatting).some(value => value === true);
}

// Utility function to get CSS classes for formatting
export function getFormattingClasses(segment: Segment): string {
  if (!segment.formatting) return '';
  
  const classes: string[] = [];
  
  if (segment.formatting.isBold) classes.push('font-bold');
  if (segment.formatting.isDeleted) classes.push('line-through');
  if (segment.formatting.isItalic) classes.push('italic');
  if (segment.formatting.isUnderlined) classes.push('underline');
  
  return classes.join(' ');
}

// Utility function to get inline styles for formatting
export function getFormattingStyles(segment: Segment): React.CSSProperties {
  if (!segment.formatting) return {};
  
  const styles: React.CSSProperties = {};
  
  if (segment.formatting.isBold) styles.fontWeight = 'bold';
  if (segment.formatting.isDeleted) styles.textDecoration = 'line-through';
  if (segment.formatting.isItalic) styles.fontStyle = 'italic';
  if (segment.formatting.isUnderlined) styles.textDecoration = 'underline';
  
  return styles;
} 