import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colors, fontFamily } from '../../theme';

interface PanelProps {
  title: string;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  minHeight?: number;
}

// Web version used `background: linear-gradient(...)`, a 1px top accent bar
// via `::before`, and border-radius/overflow-hidden. RN has no CSS gradients
// or pseudo-elements, so we use expo-linear-gradient for the panel fill and
// a plain absolutely-positioned View for the accent bar.
export function Panel({ title, eyebrow, children, style, minHeight }: PanelProps) {
  return (
    <LinearGradient
      colors={[colors.panel, colors.panel2]}
      style={[styles.panel, minHeight ? { minHeight } : undefined, style]}
    >
      <View style={styles.accentBar} />
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {eyebrow ? (
          typeof eyebrow === 'string' ? (
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          ) : (
            eyebrow
          )
        ) : null}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.lg,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.amber,
    opacity: 0.7,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.text,
    flexShrink: 1,
  },
  eyebrow: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: fontFamily.mono,
    textAlign: 'right',
  },
});
