# HTML Tag Parsing and Formatting System

This document describes the comprehensive HTML tag parsing and formatting system implemented in `textProcessingUtils.ts`.

## Overview

The system provides a robust way to parse HTML tags like `<b>`, `<del>`, `<i>`, `<u>` and track formatting state for each character/segment. This is particularly important for Japanese text where formatting tags can span single characters or multiple characters that get split into pressable segments.

## Key Features

### 1. HTML Tag Parsing
- Supports multiple HTML tags: `<b>`, `<strong>`, `<del>`, `<s>`, `<strike>`, `<i>`, `<em>`, `<u>`
- Handles nested tags correctly
- Tracks formatting state at character level
- Gracefully handles malformed tags

### 2. Formatting State Tracking
- Each character maintains its own formatting state
- Formatting state is preserved when text is segmented
- **Formatting is applied at the Segment level** (not PressableSegment level)
- Supports multiple simultaneous formatting states (bold + deleted + italic, etc.)

### 3. Language-Agnostic Processing
- Works with any language including Japanese, Chinese, English, etc.
- Integrates with existing reading aid services
- Preserves formatting across different segmentation strategies

## Usage Examples

### Basic Usage

```typescript
import { processGenericContent } from '@/utils/textProcessingUtils';

// Process text with HTML tags
const result = await processGenericContent('english', 'Hello <b>world</b>!', null);

// The result will have:
// - Clean text: "Hello world!"
// - Segments with formatting information at the Segment level
console.log(result.lines[0].pressableSegments[1].segments[0].formatting?.isBold); // true
```

### Japanese Text with Formatting

```typescript
// Japanese text with bold formatting
const japaneseText = 'こんにちは <b>世界</b>！';
const result = await processGenericContent('japanese', japaneseText, readingAidService);

// Each character in "世界" will have isBold: true at the Segment level
const boldSegment = result.lines[0].pressableSegments.find(s => s.text === '世界');
console.log(boldSegment?.segments[0]?.formatting?.isBold); // true
```

### Multiple Formatting Tags

```typescript
const text = 'Hello <b><del>world</del></b>!';
const result = await processGenericContent('english', text, null);

const segment = result.lines[0].pressableSegments[1]; // "world"
console.log(segment.segments[0].formatting?.isBold); // true
console.log(segment.segments[0].formatting?.isDeleted); // true
```

## Component Integration

### Using the SegmentText Component

```typescript
import SegmentText from '@/components/shared/SegmentText';

// Render a segment with formatting (plain text)
<SegmentText 
  segment={segment}
  type="plain"
  isBold={pressableSegment.isBold}
  isSelected={isSelectedWord}
  isFirstSelected={isFirstSelected}
  isInSelectedPhrase={isInSelectedPhrase}
  isHidden={isHidden}
  colorScheme={colorScheme}
  isTablet={isTablet}
/>

// Render a segment with ruby text (Japanese)
<SegmentText 
  segment={segment}
  type="ruby"
  isBold={pressableSegment.isBold}
  isSelected={isSelectedWord}
  isFirstSelected={isFirstSelected}
  isInSelectedPhrase={isInSelectedPhrase}
  isHidden={isHidden}
  colorScheme={colorScheme}
  isTablet={isTablet}
  lineHeight={42}
/>
```

### Manual Formatting Application

```typescript
import { getFormattingClasses, getFormattingStyles, hasFormatting } from '@/utils/textProcessingUtils';

// Check if segment has formatting
const segment = pressableSegment.segments[0]; // Get the first segment
if (hasFormatting(segment)) {
  // Apply formatting
  const classes = getFormattingClasses(segment);
  const styles = getFormattingStyles(segment);
  
  return (
    <span className={classes} style={styles}>
      {segment.baseText}
    </span>
  );
}
```

## Supported HTML Tags

| Tag | Formatting State | Description |
|-----|------------------|-------------|
| `<b>`, `<strong>` | `isBold: true` | Bold text |
| `<del>`, `<s>`, `<strike>` | `isDeleted: true` | Deleted/strikethrough text |
| `<i>`, `<em>` | `isItalic: true` | Italic text |
| `<u>` | `isUnderlined: true` | Underlined text |

## Type Definitions

### FormattingState Interface

```typescript
interface FormattingState {
  isBold?: boolean;
  isDeleted?: boolean;
  isItalic?: boolean;
  isUnderlined?: boolean;
  // Add more formatting states as needed
}
```

### Updated Segment Interface

```typescript
interface Segment {
  baseText: string;  // base text
  romaji?: string; // romaji text
  hiragana?: string; // hiragana text
  pinyin?: string; // pinyin text
  formatting?: FormattingState; // New formatting state for rendering
}
```

### PressableSegment Interface

```typescript
interface PressableSegment {
  text: string;
  type: 'plain' | 'ruby';
  isBold?: boolean;
  start_time?: number;
  end_time?: number;
  segments: Segment[]; // Each segment can have its own formatting
  messageSegmentIndex?: number;
}
```

## Implementation Details

### Character-Level Formatting Tracking

The system tracks formatting at the character level using a `CharacterFormatting` interface:

```typescript
interface CharacterFormatting {
  char: string;
  formatting: FormattingState;
}
```

### HTML Tag Parsing Algorithm

1. **Tag Detection**: Uses regex to find HTML tags
2. **Stack Management**: Maintains a stack of active tags
3. **Character Processing**: Each character gets the current formatting state
4. **State Updates**: Formatting state updates when tags open/close

### Segment Formatting Assignment

When creating segments, the system:
1. Calculates character position within the text
2. Maps segment boundaries to character formatting
3. **Assigns formatting state to individual Segment objects** (not PressableSegment)
4. Preserves formatting across different segmentation strategies

## Testing

The system includes comprehensive tests covering:

- Basic HTML tag parsing
- Nested tag handling
- Japanese text with formatting
- Multiple simultaneous formatting states
- Edge cases (malformed tags, empty text, etc.)
- Utility function validation

Run tests with:
```bash
npm test textProcessingUtils.test.ts
```

## Future Extensions

The system is designed to be easily extensible:

1. **New HTML Tags**: Add new cases to the `parseHtmlTags` function
2. **New Formatting States**: Extend the `FormattingState` interface
3. **Custom Formatting**: Add custom formatting logic in the parsing function
4. **CSS Integration**: Extend utility functions for custom CSS classes

## Performance Considerations

- Character-level tracking is memory-efficient for typical text lengths
- Regex-based parsing is fast for most use cases
- Formatting state is computed once during parsing
- No runtime performance impact during rendering

## Migration Guide

### From Old Bold Processing

**Old approach:**
```typescript
// Old way - only handled <b> tags
let processedContent = textContent.replace(/<b>([^<]+)<\/b>/g, (_, phrase) => {
  return phrase.split(' ').map((word: string) => `*${word}*`).join(' ');
});
```

**New approach:**
```typescript
// New way - handles all HTML tags with proper formatting state at Segment level
const { cleanText, characterFormatting } = parseHtmlTags(textContent);
// Formatting state is automatically tracked and applied to individual Segment objects
```

### From PressableSegment to Segment Formatting

**Old approach (if you had PressableSegment formatting):**
```typescript
// Old way - formatting on PressableSegment
if (pressableSegment.formatting?.isBold) {
  // Apply bold formatting
}
```

**New approach:**
```typescript
// New way - formatting on individual Segment objects
const segment = pressableSegment.segments[0];
if (segment.formatting?.isBold) {
  // Apply bold formatting
}
```

The new system provides much more robust HTML parsing and formatting state management while maintaining backward compatibility with existing code. The key change is that formatting is now applied at the individual Segment level rather than the PressableSegment level, providing more granular control over text formatting. 