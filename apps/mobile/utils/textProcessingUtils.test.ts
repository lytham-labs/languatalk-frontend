import { processGenericContent, hasFormatting, getFormattingClasses, getFormattingStyles } from './textProcessingUtils';
import { PressableSegment, FormattingState, Segment } from '@/types/chat';

// Mock reading aid service for testing
const mockReadingAidService = {
  processText: async (text: string, includeReading: boolean, includeBolding: boolean) => {
    // Simulate Japanese text processing by splitting into characters
    return text.split('').map(char => ({
      text: char,
      type: 'plain' as const,
      segments: [{ baseText: char }]
    }));
  }
};

// Mock reading aid service that splits Japanese text into segments
const mockJapaneseReadingAidService = {
  processText: async (text: string, includeReading: boolean, includeBolding: boolean) => {
    // Simulate Japanese text processing that might split characters
    // This could happen with complex Japanese text processing
    const segments = [];
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // Simulate that some characters might be split into multiple segments
      if (char === '世') {
        segments.push({
          text: '世',
          type: 'plain' as const,
          segments: [{ baseText: '世' }]
        });
      } else if (char === '界') {
        segments.push({
          text: '界',
          type: 'plain' as const,
          segments: [{ baseText: '界' }]
        });
      } else {
        segments.push({
          text: char,
          type: 'plain' as const,
          segments: [{ baseText: char }]
        });
      }
    }
    return segments;
  }
};

describe('Text Processing Utils', () => {
  describe('HTML Tag Parsing', () => {
    it('should parse bold tags correctly', async () => {
      const text = 'Hello <b>world</b>!';
      const result = await processGenericContent('english', text, null);
      
      expect(result.content).toBe('Hello world!');
      expect(result.lines?.[0].pressableSegments).toHaveLength(2); // "Hello" and "world!"
      
      const segments = result.lines?.[0].pressableSegments || [];
      expect(segments[0].text).toBe('Hello');
      expect(segments[0].segments[0].formatting?.isBold).toBeFalsy();
      
      expect(segments[1].text).toBe('world!'); // groupSpecialCharacters merges "world" and "!"
      expect(segments[1].segments[0].formatting?.isBold).toBe(true);
    });

    it('should parse delete tags correctly', async () => {
      const text = 'Hello <del>world</del>!';
      const result = await processGenericContent('english', text, null);
      
      expect(result.content).toBe('Hello world!');
      const segments = result.lines?.[0].pressableSegments || [];
      
      expect(segments[1].text).toBe('world!'); // groupSpecialCharacters merges "world" and "!"
      expect(segments[1].segments[0].formatting?.isDeleted).toBe(true);
    });

    it('should parse multiple formatting tags', async () => {
      const text = 'Hello <b><del>world</del></b>!';
      const result = await processGenericContent('english', text, null);
      
      const segments = result.lines?.[0].pressableSegments || [];
      expect(segments[1].text).toBe('world!'); // groupSpecialCharacters merges "world" and "!"
      expect(segments[1].segments[0].formatting?.isBold).toBe(true);
      expect(segments[1].segments[0].formatting?.isDeleted).toBe(true);
    });

    it('should handle Japanese text with formatting', async () => {
      const text = 'こんにちは <b>世界</b>！';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('こんにちは 世界！');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "世界" has bold formatting
      const worldSegments = segments.filter(s => s.text === '世' || s.text === '界');
      worldSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBe(true);
      });
    });

    it('should handle nested tags correctly', async () => {
      const text = 'Hello <b><i><del>world</del></i></b>!';
      const result = await processGenericContent('english', text, null);
      
      const segments = result.lines?.[0].pressableSegments || [];
      expect(segments[1].text).toBe('world!'); // groupSpecialCharacters merges "world" and "!"
      expect(segments[1].segments[0].formatting?.isBold).toBe(true);
      expect(segments[1].segments[0].formatting?.isItalic).toBe(true);
      expect(segments[1].segments[0].formatting?.isDeleted).toBe(true);
    });

    it('should handle malformed tags gracefully', async () => {
      const text = 'Hello <b>world<i>test</b>!';
      const result = await processGenericContent('english', text, null);
      
      // Should still process what it can
      expect(result.content).toBe('Hello worldtest!');
    });
  });

  describe('Spanish Text Formatting Tests', () => {
    it('should handle Spanish text with bold formatting', async () => {
      const text = '¡Hola <b>mundo</b>! ¿Cómo estás?';
      const result = await processGenericContent('spanish', text, null);
      
      expect(result.content).toBe('¡Hola mundo! ¿Cómo estás?');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const boldSegment = segments.find(s => s.text.includes('mundo'));
      expect(boldSegment?.segments[0].formatting?.isBold).toBe(true);
    });

    it('should handle Spanish text with delete formatting', async () => {
      const text = 'El <del>perro</del> gato está aquí.';
      const result = await processGenericContent('spanish', text, null);
      
      expect(result.content).toBe('El perro gato está aquí.');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const deletedSegment = segments.find(s => s.text.includes('perro'));
      expect(deletedSegment?.segments[0].formatting?.isDeleted).toBe(true);
    });

    it('should handle Spanish text with italic formatting', async () => {
      const text = 'La <i>casa</i> es bonita.';
      const result = await processGenericContent('spanish', text, null);
      
      expect(result.content).toBe('La casa es bonita.');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const italicSegment = segments.find(s => s.text.includes('casa'));
      expect(italicSegment?.segments[0].formatting?.isItalic).toBe(true);
    });

    it('should handle Spanish text with underline formatting', async () => {
      const text = 'El <u>libro</u> está en la mesa.';
      const result = await processGenericContent('spanish', text, null);
      
      expect(result.content).toBe('El libro está en la mesa.');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const underlinedSegment = segments.find(s => s.text.includes('libro'));
      expect(underlinedSegment?.segments[0].formatting?.isUnderlined).toBe(true);
    });

    it('should handle Spanish text with multiple formatting types', async () => {
      const text = 'El <b><i><del>coche</del></i></b> es rojo.';
      const result = await processGenericContent('spanish', text, null);
      
      expect(result.content).toBe('El coche es rojo.');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const formattedSegment = segments.find(s => s.text.includes('coche'));
      expect(formattedSegment?.segments[0].formatting?.isBold).toBe(true);
      expect(formattedSegment?.segments[0].formatting?.isItalic).toBe(true);
      expect(formattedSegment?.segments[0].formatting?.isDeleted).toBe(true);
    });

    it('should handle Spanish text with mixed formatting across words', async () => {
      const text = 'El <b>perro</b> y el <i>gato</i> son <del>amigos</del>.';
      const result = await processGenericContent('spanish', text, null);
      
      expect(result.content).toBe('El perro y el gato son amigos.');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const boldSegment = segments.find(s => s.text.includes('perro'));
      const italicSegment = segments.find(s => s.text.includes('gato'));
      const deletedSegment = segments.find(s => s.text.includes('amigos'));
      
      expect(boldSegment?.segments[0].formatting?.isBold).toBe(true);
      expect(italicSegment?.segments[0].formatting?.isItalic).toBe(true);
      expect(deletedSegment?.segments[0].formatting?.isDeleted).toBe(true);
    });
  });

  describe('Japanese Text Formatting Tests', () => {
    it('should handle Japanese text with bold formatting', async () => {
      const text = 'こんにちは <b>世界</b>！';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('こんにちは 世界！');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "世界" has bold formatting
      const worldSegments = segments.filter(s => s.text === '世' || s.text === '界');
      worldSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBe(true);
      });
    });

    it('should handle Japanese text with delete formatting', async () => {
      const text = '今日は <del>明日</del> です。';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('今日は 明日 です。');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "明日" has delete formatting
      const tomorrowSegments = segments.filter(s => s.text === '明' || s.text === '日');
      tomorrowSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isDeleted).toBe(true);
      });
    });

    it('should handle Japanese text with italic formatting', async () => {
      const text = 'これは <i>本</i> です。';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('これは 本 です。');
      const segments = result.lines?.[0].pressableSegments || [];
      
      const bookSegment = segments.find(s => s.text === '本');
      expect(bookSegment?.segments[0].formatting?.isItalic).toBe(true);
    });

    it('should handle Japanese text with underline formatting', async () => {
      const text = '彼は <u>学生</u> です。';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('彼は 学生 です。');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "学生" has underline formatting
      const studentSegments = segments.filter(s => s.text === '学' || s.text === '生');
      studentSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isUnderlined).toBe(true);
      });
    });

    it('should handle Japanese text with multiple formatting types', async () => {
      const text = 'これは <b><i><del>重要</del></i></b> です。';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('これは 重要 です。');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "重要" has all three formatting types
      const importantSegments = segments.filter(s => s.text === '重' || s.text === '要');
      importantSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBe(true);
        expect(segment.segments[0].formatting?.isItalic).toBe(true);
        expect(segment.segments[0].formatting?.isDeleted).toBe(true);
      });
    });

    it('should handle Japanese text with mixed formatting across characters', async () => {
      const text = '私は <b>学生</b> で、<i>先生</i> は <del>親切</del> です。';
      const result = await processGenericContent('japanese', text, mockReadingAidService);
      
      expect(result.content).toBe('私は 学生 で、先生 は 親切 です。');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check bold formatting for "学生"
      const studentSegments = segments.filter(s => s.text === '学' || s.text === '生');
      studentSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBe(true);
      });
      
      // Check italic formatting for "先生"
      const teacherSegments = segments.filter(s => s.text === '先' || s.text === '生');
      teacherSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isItalic).toBe(true);
      });
      
      // Check delete formatting for "親切"
      const kindSegments = segments.filter(s => s.text === '親' || s.text === '切');
      kindSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isDeleted).toBe(true);
      });
    });

    it('should handle Japanese text with delete and bold formatting that splits segments', async () => {
      // This test specifically addresses the case where Japanese text with delete and bold
      // formatting might split characters into separate segments
      const text = 'こんにちは <b><del>世界</del></b>！';
      const result = await processGenericContent('japanese', text, mockJapaneseReadingAidService);
      
      expect(result.content).toBe('こんにちは 世界！');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "世界" has both bold and delete formatting
      // even though they might be split into separate segments
      const worldSegments = segments.filter(s => s.text === '世' || s.text === '界');
      expect(worldSegments.length).toBeGreaterThan(0);
      
      worldSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBe(true);
        expect(segment.segments[0].formatting?.isDeleted).toBe(true);
      });
    });

    it('should handle complex Japanese text with nested formatting that splits segments', async () => {
      const text = 'これは <del>非</del>常に重要な テストです。';
      const result = await processGenericContent('japanese', text, mockJapaneseReadingAidService);
      
      expect(result.content).toBe('これは 非常に重要な テストです。');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Check that each character in "非常に重要な" has all three formatting types
      const importantSegments = segments.filter(s => 
        s.text === '非' || s.text === '常' || s.text === 'に' || 
        s.text === '重' || s.text === '要' || s.text === 'な'
      );
      
      expect(importantSegments.length).toBeGreaterThan(0);
      importantSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isDeleted).toBe(true);
      });
    });

    it('should handle Japanese text with formatting across multiple lines', async () => {
      const text = 'こんにちは <b>世界</b>！\n今日は <i>良い</i> 天気です。\n<del>明日</del> も晴れます。';
      const result = await processGenericContent('japanese', text, mockJapaneseReadingAidService);
      
      expect(result.content).toBe('こんにちは 世界！\n今日は 良い 天気です。\n明日 も晴れます。');
      expect(result.lines?.length).toBe(3);
      
      // Check first line - bold formatting
      const firstLineSegments = result.lines?.[0].pressableSegments || [];
      const worldSegments = firstLineSegments.filter(s => s.text === '世' || s.text === '界');
      worldSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBe(true);
      });
      
      // Check second line - italic formatting
      const secondLineSegments = result.lines?.[1].pressableSegments || [];
      const goodSegments = secondLineSegments.filter(s => s.text === '良' || s.text === 'い');
      goodSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isItalic).toBe(true);
      });
      
      // Check third line - delete formatting
      const thirdLineSegments = result.lines?.[2].pressableSegments || [];
      const tomorrowSegments = thirdLineSegments.filter(s => s.text === '明' || s.text === '日');
      tomorrowSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isDeleted).toBe(true);
      });
    });
  });

  describe('Formatting Utility Functions', () => {
    it('should detect formatting correctly', () => {
      const segmentWithFormatting: Segment = {
        baseText: 'test',
        formatting: { isBold: true, isDeleted: false }
      };
      
      const segmentWithoutFormatting: Segment = {
        baseText: 'test'
      };
      
      expect(hasFormatting(segmentWithFormatting)).toBe(true);
      expect(hasFormatting(segmentWithoutFormatting)).toBe(false);
    });

    it('should generate correct CSS classes', () => {
      const segment: Segment = {
        baseText: 'test',
        formatting: { 
          isBold: true, 
          isDeleted: true, 
          isItalic: false,
          isUnderlined: true 
        }
      };
      
      const classes = getFormattingClasses(segment);
      expect(classes).toContain('font-bold');
      expect(classes).toContain('line-through');
      expect(classes).toContain('underline');
      expect(classes).not.toContain('italic');
    });

    it('should generate correct inline styles', () => {
      const segment: Segment = {
        baseText: 'test',
        formatting: { 
          isBold: true, 
          isDeleted: true, 
          isItalic: true,
          isUnderlined: false 
        }
      };
      
      const styles = getFormattingStyles(segment);
      expect(styles.fontWeight).toBe('bold');
      expect(styles.textDecoration).toBe('line-through');
      expect(styles.fontStyle).toBe('italic');
      expect(styles.textDecoration).not.toBe('underline');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const result = await processGenericContent('english', '', null);
      expect(result.content).toBe('');
      expect(result.lines).toEqual([]);
    });

    it('should handle text with only tags', async () => {
      const text = '<b></b>';
      const result = await processGenericContent('english', text, null);
      expect(result.content).toBe('');
    });

    it('should handle self-closing tags', async () => {
      const text = 'Hello <br/> world';
      const result = await processGenericContent('english', text, null);
      expect(result.content).toBe('Hello <br/> world'); // Self-closing tags are not handled by our regex
    });

    it('should handle tags with attributes', async () => {
      const text = 'Hello <b class="test">world</b>!';
      const result = await processGenericContent('english', text, null);
      expect(result.content).toBe('Hello world!');
      
      const segments = result.lines?.[0].pressableSegments || [];
      expect(segments[1].segments[0].formatting?.isBold).toBe(true);
    });

    it('should handle specific correction text with bold formatting', async () => {
      const text = 'Corrected: I need <b>a</b> text that will return with a <b>tag</b> in the correction.';
      const result = await processGenericContent('english', text, null);
      
      expect(result.content).toBe('Corrected: I need a text that will return with a tag in the correction.');
      const segments = result.lines?.[0].pressableSegments || [];
      
      // Find the segments that should be bold
      const boldSegments = segments.filter(s => s.text === 'a' || s.text === 'tag');
      
      // There should be 3 segments: two "a" words and one "tag" word
      expect(boldSegments.length).toBe(3);
      
      // Check that only the correct segments have bold formatting
      const boldSegmentsWithFormatting = boldSegments.filter(s => s.segments[0].formatting?.isBold);
      expect(boldSegmentsWithFormatting.length).toBe(2);
      
      // Verify the specific segments that should be bold
      const firstASegment = segments.find(s => s.text === 'a' && s.segments[0].formatting?.isBold);
      const tagSegment = segments.find(s => s.text === 'tag' && s.segments[0].formatting?.isBold);
      
      expect(firstASegment).toBeDefined();
      expect(tagSegment).toBeDefined();
      
      // Verify non-bold segments don't have bold formatting
      const nonBoldSegments = segments.filter(s => s.text !== 'a' && s.text !== 'tag');
      nonBoldSegments.forEach(segment => {
        expect(segment.segments[0].formatting?.isBold).toBeFalsy();
      });
    });
  });

  describe('Contraction Handling', () => {
    it('should handle contractions correctly without splitting on apostrophes', async () => {
      const text = "I don't want to go, but I can't help it.";
      const result = await processGenericContent('en', text, null);

      expect(result.lines).toBeDefined();
      expect(result.lines!.length).toBeGreaterThan(0);
      
      // Check that contractions are kept together
      const allSegments = result.lines!.flatMap(line => line.pressableSegments);
      const segmentTexts = allSegments.map(segment => segment.text);
      
      // Should contain "don't" and "can't" as single segments
      expect(segmentTexts.some(text => text.includes("don't"))).toBe(true);
      expect(segmentTexts.some(text => text.includes("can't"))).toBe(true);
      
      // Should not have split versions
      expect(segmentTexts.some(text => text === "don")).toBe(false);
      expect(segmentTexts.some(text => text === "t")).toBe(false);
    });

    it('should handle "you\'d" correctly without splitting', async () => {
      const text = "You'd like to go, wouldn't you?";
      const result = await processGenericContent('en', text, null);

      expect(result.lines).toBeDefined();
      expect(result.lines!.length).toBeGreaterThan(0);
      
      // Check that "you'd" is kept together
      const allSegments = result.lines!.flatMap(line => line.pressableSegments);
      const segmentTexts = allSegments.map(segment => segment.text);
      
      // Should contain "you'd" and "wouldn't" as single segments
      expect(segmentTexts.some(text => text.toLowerCase() === "you'd")).toBe(true);
      expect(segmentTexts.some(text => text.toLowerCase() === "wouldn't")).toBe(true);
      
      // Should not have split versions
      expect(segmentTexts.some(text => text.toLowerCase() === "you")).toBe(false);
      expect(segmentTexts.some(text => text.toLowerCase() === "d")).toBe(false);
    });

    it('should handle contractions in mixed English/Japanese text', async () => {
      const text = "You'd like to go to 東京, wouldn't you?";
      const result = await processGenericContent('en', text, null);

      expect(result.lines).toBeDefined();
      expect(result.lines!.length).toBeGreaterThan(0);
      
      // Check that contractions are kept together
      const allSegments = result.lines!.flatMap(line => line.pressableSegments);
      const segmentTexts = allSegments.map(segment => segment.text);
      
      
      // Should contain contractions as single segments
      expect(segmentTexts.some(text => text.toLowerCase() === "you'd")).toBe(true);
      expect(segmentTexts.some(text => text.toLowerCase() === "wouldn't")).toBe(true);
      
      // Should not have split versions
      expect(segmentTexts.some(text => text.toLowerCase() === "you")).toBe(false);
      expect(segmentTexts.some(text => text.toLowerCase() === "d")).toBe(false);
    });

    it('should handle contractions in JapaneseTextService when segmentation fails', async () => {
      const text = "Don't know how to say something. I want to see some text correct with deleted text and bold";
      
      // Mock the JapaneseTextService to simulate segmentation failure
      const mockJapaneseTextService = {
        processText: async (text: string) => {
          // Simulate segmentation failure by throwing an error
          throw new Error("Segmentation failed");
        }
      };
      
      // Test the fallback behavior
      const result = await processGenericContent('japanese', text, mockJapaneseTextService);
      
      expect(result.lines).toBeDefined();
      expect(result.lines!.length).toBeGreaterThan(0);
      
      // Check that contractions are kept together
      const allSegments = result.lines!.flatMap(line => line.pressableSegments);
      const segmentTexts = allSegments.map(segment => segment.text);
      
      
      // Should contain contractions as single segments
      expect(segmentTexts.some(text => text.toLowerCase() === "don't")).toBe(true);
      
      // Should not have split versions
      expect(segmentTexts.some(text => text.toLowerCase() === "don")).toBe(false);
      expect(segmentTexts.some(text => text.toLowerCase() === "t")).toBe(false);
    });

    it('should handle English contractions in JapaneseTextService without interference', async () => {
      const text = "You'd like to go, wouldn't you?";
      
      // Create a mock JapaneseTextService that processes English text
      const mockJapaneseTextService = {
        processText: async (text: string) => {
          // Simulate the JapaneseTextService processing for English text
          const segments = text.split(/\s+/).filter(word => word.length > 0);
          
          return segments.map(segment => ({
            text: segment,
            type: 'plain' as const,
            segments: [{baseText: segment}],
            isBold: false
          }));
        }
      };
      
      // Test the processing behavior
      const result = await processGenericContent('japanese', text, mockJapaneseTextService);
      
      expect(result.lines).toBeDefined();
      expect(result.lines!.length).toBeGreaterThan(0);
      
      // Check that contractions are kept together
      const allSegments = result.lines!.flatMap(line => line.pressableSegments);
      const segmentTexts = allSegments.map(segment => segment.text);
      
      console.log('English text segments:', segmentTexts);
      
      // Should contain contractions as single segments
      expect(segmentTexts.some(text => text.toLowerCase() === "you'd")).toBe(true);
      expect(segmentTexts.some(text => text.toLowerCase() === "wouldn't")).toBe(true);
      
      // Should not have split versions
      expect(segmentTexts.some(text => text.toLowerCase() === "you")).toBe(false);
      expect(segmentTexts.some(text => text.toLowerCase() === "d")).toBe(false);
    });

    it('should handle English text in JapaneseTextService without Japanese tokenizer', async () => {
      const text = "To start, let's begin with something simple.";
      
      // Create a mock JapaneseTextService that simulates the real behavior
      const mockJapaneseTextService = {
        processText: async (text: string) => {
          // Simulate the createSegments function behavior for English text
          const segments = text.split(/\s+/).filter(word => word.length > 0);
          
          return segments.map(segment => ({
            text: segment,
            type: 'plain' as const,
            segments: [{baseText: segment}],
            isBold: false
          }));
        }
      };
      
      // Test the processing behavior
      const result = await processGenericContent('japanese', text, mockJapaneseTextService);
      
      expect(result.lines).toBeDefined();
      expect(result.lines!.length).toBeGreaterThan(0);
      
      // Check that contractions are kept together
      const allSegments = result.lines!.flatMap(line => line.pressableSegments);
      const segmentTexts = allSegments.map(segment => segment.text);
      
      console.log('English text with contractions:', segmentTexts);
      
      // Should contain contractions as single segments
      expect(segmentTexts.some(text => text.toLowerCase() === "let's")).toBe(true);
      
      // Should not have split versions
      expect(segmentTexts.some(text => text.toLowerCase() === "let")).toBe(false);
      expect(segmentTexts.some(text => text.toLowerCase() === "s")).toBe(false);
    });
  });
}); 