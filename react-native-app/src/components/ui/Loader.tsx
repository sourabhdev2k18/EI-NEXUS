import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';

interface LoaderProps {
  label?: string;
}

export function Loader({ label = 'Loading...' }: LoaderProps) {
  return (
    // accessibilityLiveRegion mirrors the web version's aria-live="polite"
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityRole="text">
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 60,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
  },
  text: {
    color: colors.muted,
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
    textAlign: 'center',
  },
});
