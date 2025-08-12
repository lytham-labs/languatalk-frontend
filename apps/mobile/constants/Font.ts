import { Dimensions, PixelRatio, StyleSheet, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Use whichever is smaller, width or height
const SCALE = SCREEN_WIDTH > SCREEN_HEIGHT ? SCREEN_HEIGHT : SCREEN_WIDTH;

// Base width for scaling calculations
const BASE_WIDTH = 375;

// Configuration object for fine-tuning text sizes
const fontConfig = {
    phone: {
        small: { min: 0.8, max: 1 },
        medium: { min: 0.9, max: 1.1 },
        large: { min: 1, max: 1.2 },
    },
    tablet: {
        small: { min: 1.2, max: 1.3 },
        medium: { min: 1.2, max: 1.4 },
        large: { min: 1.2, max: 1.5 },
    },
};

// Configuration object for fine-tuning text sizes
const iconConfig = {
    phone: {
        small: { min: 0.8, max: 1 },
        medium: { min: 0.8, max: 1 },
        large: { min: 0.8, max: 1 },
    },
    tablet: {
        small: { min: 1.1, max: 1.2 },
        medium: { min: 1.2, max: 1.3 },
        large: { min: 1.2, max: 1.4 },
    },
};

// Helper function to get device type
export const getDeviceType = (): 'phone' | 'tablet' => {
    const pixelDensity = PixelRatio.get();
    const adjustedWidth = SCREEN_WIDTH * pixelDensity;
    const adjustedHeight = SCREEN_HEIGHT * pixelDensity;

    if (pixelDensity < 2 && (adjustedWidth >= 1000 || adjustedHeight >= 1000)) {
        return 'tablet';
    } else if (pixelDensity === 2 && (adjustedWidth >= 1920 || adjustedHeight >= 1920)) {
        return 'tablet';
    } else {
        return 'phone';
    }
};

// Helper to detect if running on iPad
const isIpad = () => {
    const { width, height } = Dimensions.get('window');
    return (
      Platform.OS === 'ios' &&
      (Platform.isPad ||
       (width > 700 && height > 700) || 
       (width > 960 && height > 720))
    );
  };

// Helper function to get the appropriate font size
export const getFontStyle = (desiredStyle: keyof typeof GlobalFontStyleSheet) => {
    if (!isIpad()) {
      return GlobalFontStyleSheet[desiredStyle];
    }
  
    // Drop font sizes by one level for iPad
    switch (desiredStyle) {
      case 'text2Xl':
        return GlobalFontStyleSheet.textLg;
      case 'textXl':
        return GlobalFontStyleSheet.textBase;
      case 'textLg':
        return GlobalFontStyleSheet.textSm;
      case 'textMd':
        return GlobalFontStyleSheet.textSm;
      case 'textBase':
        return GlobalFontStyleSheet.text14;
      case 'textSm':
        return GlobalFontStyleSheet.text14;
      default:
        return GlobalFontStyleSheet[desiredStyle];
    }
  };


// Helper function to determine screen size category
export const getScreenSizeCategory = (): 'small' | 'medium' | 'large' => {
    if (SCALE < 400) return 'small';
    if (SCALE > 500) return 'large';
    return 'medium';
};

export const getFontSize = (size: number): number => {
    const deviceType = getDeviceType();
    const screenCategory = getScreenSizeCategory();
    const config = fontConfig[deviceType][screenCategory];

    // Calculate the scale factor
    const scaleFactor = SCALE / BASE_WIDTH;

    // Clamp the scale factor between the configured min and max
    const clampedScaleFactor = Math.min(Math.max(scaleFactor, config.min), config.max);

    // Calculate the new size
    let newSize = size * clampedScaleFactor;

    // Additional scaling for tablets to ensure text isn't too small
    if (deviceType === 'tablet') {
        newSize *= 1.1; // Increase tablet font sizes by an additional 10%
    }

    // Round the size and adjust for the device's font scale
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) / PixelRatio.getFontScale();
};

export const getIconSize = (size: number): number => {
    const deviceType = getDeviceType();
    const screenCategory = getScreenSizeCategory();
    const config = iconConfig[deviceType][screenCategory];
    const fontScale = PixelRatio.getFontScale();
    // Calculate the scale factor
    const scaleFactor = SCALE / BASE_WIDTH;

    // Clamp the scale factor between the configured min and max
    const clampedScaleFactor = Math.min(Math.max(scaleFactor, config.min), config.max);

    // Calculate the new size
    let newSize = size * clampedScaleFactor;

    // Additional scaling for tablets to ensure text isn't too small
    if (deviceType === 'tablet') {
        newSize *= 1.1; // Increase tablet font sizes by an additional 10%
    }

    // Round the size and adjust for the device's font scale
    return (Math.round(PixelRatio.roundToNearestPixel(newSize)) / PixelRatio.getFontScale()) * fontScale;
};

// Function to adjust font configuration
export const adjustFontConfig = (
    deviceType: 'phone' | 'tablet',
    sizeCategory: 'small' | 'medium' | 'large',
    minScale: number,
    maxScale: number
) => {
    fontConfig[deviceType][sizeCategory] = { min: minScale, max: maxScale };
};

export const GlobalFontStyleSheet = StyleSheet.create({
    // TODO: Condense the existing font size styles into these global font sizes
    'textInput': {
        fontFamily: 'Lato-Regular',
        fontSize: getFontSize(14),
        lineHeight: getFontSize(20),
    },
    'textBase': {
        fontFamily: 'Lato-Regular',
        'fontSize': getFontSize(16),
        'lineHeight': getFontSize(18),
    },
    'textSm': {
        fontFamily: 'Lato-Regular',
        'fontSize': getFontSize(12),
        'lineHeight': getFontSize(14),
    },
    'text14': {
        fontFamily: 'Lato-Regular',
        'fontSize': getFontSize(14),
        'lineHeight': getFontSize(14),
    },
    // TODO: Make a specific textMd style for chat
    'textMd': Platform.select({
        android: {
            fontFamily: 'Lato-Regular',
            'fontSize': getFontSize(16),
            'lineHeight': getFontSize(16),
        },
        default: {
            fontFamily: 'Lato-Regular',
            'fontSize': getFontSize(15),
            'lineHeight': getFontSize(15),
        }
    }),
    'textLg': {
        fontFamily: 'Lato-Regular',
        'fontSize': getFontSize(18),
        'lineHeight': getFontSize(18),
    },
    'textXl': {
        fontFamily: 'Lato-Regular',
        'fontSize': getFontSize(20),
        'lineHeight': getFontSize(22),
    },
    'text2Xl': {
        fontFamily: 'Lato-Bold',
        'fontSize': getFontSize(24),
        'lineHeight': getFontSize(28),
    },
    'heading': {
        fontFamily: 'Lato-Bold',
        'fontSize': getFontSize(20),
        'lineHeight': getFontSize(24),
    },
    'subheading': {
        fontFamily: 'Lato-Medium',
        'fontSize': getFontSize(16),
        'lineHeight': getFontSize(20),
    }
    //TODO: setup some icon style sizes too

});

// // Example usage
// console.log('Device type:', getDeviceType());
// console.log('Font size for 16:', getFontSize(16));

// // Example of adjusting font configuration
// adjustFontConfig('phone', 'medium', 0.95, 1.15);
// console.log('Adjusted font size for 16:', getFontSize(16));
