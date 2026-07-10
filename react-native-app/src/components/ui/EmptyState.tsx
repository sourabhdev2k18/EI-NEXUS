import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fontFamily } from '../../theme';

interface EmptyStateProps {
  children: React.ReactNode;
  color?: string;
  style?: ViewStyle;
}

// The web version reused a `.empty-trace` CSS class with embedded <br/> line
// breaks inside JSX strings. RN Text doesn't render <br/>, so callers pass an
// array of lines / a multi-line string and we split on '\n'.
export function EmptyState({ children, color = colors.muted, style }: EmptyStateProps) {
  const text = typeof children === 'string' ? children : String(children);
  const lines = text.split('\n');
  return (
    <View style={[styles.wrap, style]}>
      {lines.map((line, index) => (
        <Text key={index} style={[styles.text, { color }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
