import { blue, red } from 'react-native-reanimated/lib/typescript/reanimated2/Colors';

/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
        background: {
          light: '#f2f4f8',
          dark: '#FC5D5D',
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
          450: '#484848',
          500: '#3d4752',
          600: '#303840',
          700: '#252b32',
          800: '#181c20',
          900: '#0d0f12',
          950: '#070809'
        },
      }
    },
  },
  plugins: [],
}
