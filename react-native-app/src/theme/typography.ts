import { Platform } from 'react-native';

// The original web app used 'IBM Plex Sans' (body), 'JetBrains Mono' (mono/data),
// and 'Space Grotesk' (display headings) loaded via @font-face.
// In RN these must be loaded as native fonts (see App.tsx useFonts call with
// @expo-google-fonts/ibm-plex-sans, @expo-google-fonts/jetbrains-mono and
// @expo-google-fonts/space-grotesk). We fall back to the OS system font so the
// app still renders correctly before fonts finish loading or if that package
// is not installed.
export const fontFamily = {
  body: Platform.select({ ios: 'IBMPlexSans_400Regular', android: 'IBMPlexSans_400Regular', default: 'System' }),
  bodySemiBold: Platform.select({ ios: 'IBMPlexSans_600SemiBold', android: 'IBMPlexSans_600SemiBold', default: 'System' }),
  mono: Platform.select({ ios: 'JetBrainsMono_400Regular', android: 'JetBrainsMono_400Regular', default: 'Courier' }),
  display: Platform.select({ ios: 'SpaceGrotesk_600SemiBold', android: 'SpaceGrotesk_600SemiBold', default: 'System' }),
};

export const fontSize = {
  xs: 11,
  sm: 12.5,
  base: 13,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
} as const;

export const typography = {
  body: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: undefined },
  mono: { fontFamily: fontFamily.mono, fontSize: fontSize.sm },
  display: { fontFamily: fontFamily.display, fontSize: fontSize.xxl, fontWeight: '600' as const },
  label: { fontFamily: fontFamily.mono, fontSize: fontSize.xs, letterSpacing: 0.5 },
};
