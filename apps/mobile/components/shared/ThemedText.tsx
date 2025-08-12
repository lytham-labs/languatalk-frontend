import { Text, type TextProps, StyleSheet } from 'react-native';
import { getFontSize } from '@/constants/Font';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'small'  | 'title' | 'defaultSemiBold' | 'subtitle' | 'link' | 'input';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'small' ? styles.small : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'input' ? styles.input : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: getFontSize(12),
    lineHeight: getFontSize(14),
  },
  default: {
    fontSize: getFontSize(16),
    lineHeight: getFontSize(20),
  },
  defaultSemiBold: {
    fontSize: getFontSize(16),
    lineHeight: getFontSize(24),
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: getFontSize(32),
  },
  subtitle: {
    fontSize: getFontSize(20),
    fontWeight: 'bold',
  },
  link: {
    lineHeight: getFontSize(24),
    fontSize: getFontSize(16),
    color: '#0a7ea4',
  },
  input: { 
    fontSize: getFontSize(14),
    lineHeight: getFontSize(20),
  }
});
