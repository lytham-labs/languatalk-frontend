import { DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { useColorScheme, cssInterop } from 'nativewind'

import type { Theme } from '@react-navigation/native'

import type { ReactNode } from 'react'
import './global.css'

const InteropThemeProvider = cssInterop(
  ({
    children,
    ...colors
  }: Theme['colors'] & { readonly children: ReactNode }) => {
    const { colorScheme } = useColorScheme()
    return (
      <ThemeProvider
        value={{
          dark: colorScheme === 'dark',
          colors,
        }}
      >
        {children}
      </ThemeProvider>
    )
  },
  Object.fromEntries(
    Object.keys(DefaultTheme.colors).map((name) => [
      name,
      {
        target: name,
        nativeStyleToProp: {
          color: name,
        },
      },
    ]),
  ) as {
    [K in keyof Theme['colors']]: {
      target: K
      nativeStyleToProp: {
        color: K
      }
    }
  },
);

export default InteropThemeProvider;