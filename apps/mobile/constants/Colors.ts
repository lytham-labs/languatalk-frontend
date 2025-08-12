/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#00448F';
const tintColorDark = '#258EFF';

export const Colors = {
  light: {
    text: '#3d4752',
    header_text: '#ffffff',
    background: '#f2f4f8',
    background_brand: '#f2f4f8',
    background_highlight: '#FC5D5D',
    background_secondary: '#f2f4f8',
    background_header: '#3d4752',
    background_button: '#f2f4f8',
    border: '#d6dbe1',
    buttonBorder: '#070809',
    tint: tintColorLight,
    icon: '#00448F',
    tabIconDefault: '#484848',
    tabIconSelected: tintColorLight,
    placeholderText: '#3d4752',
  },
  dark: {
    text: '#FFFFFF',
    header_text: '#FFFFFF',
    background: '#181c20',
    background_brand: '#FC5D5D',
    background_secondary: '#f2f4f8',
    background_header: '#FC5D5D',
    border: '#8191a1',
    buttonBorder: '#d6dbe1',
    background_button: '#070809',
    tint: tintColorDark,
    icon: '#00448F',
    tabIconDefault: '#00448F',
    tabIconSelected: tintColorLight,
    placeholderText: '#ebedf0',
  },
  primary: {
    DEFAULT: '#FC5D5D',  
    light: '#FC5D5D',  
    dark: '#FFFFFF',
  },
  secondary: {
    DEFAULT: '#00448F',  
    light: '#00448F',  
    dark: '#FFFFFF',
  },
  peach: {
    50: "#FFF0F0",
    100: "#FEE1E1",
    200: "#FEBEBE",
    300: "#FDA0A0",
    400: "#FD7D7D",
    500: "#FC5D5D",
    600: "#FB1919",
    700: "#CD0404",
    800: "#870202",
    900: "#460101",
    950: "#230101"
  },
  blue: {
    50: "#DBEDFF",
    100: "#B8DAFF",
    200: "#6BB3FF",
    300: "#248EFF",
    400: "#0068D6",
    500: "#00448F",
    600: "#003670",
    700: "#002A57",
    800: "#001B38",
    900: "#000F1F",
    950: "#00070F"
  },
  gray: {
    50: '#ebedf0',
    100: '#d6dbe1',
    200: '#aab5c0',
    300: '#8191a1',
    400: '#5b6b7b',
    500: '#3d4752',
    600: '#303840',
    700: '#252b32',
    800: '#181c20',
    900: '#0d0f12',
    950: '#070809'
  },
};
