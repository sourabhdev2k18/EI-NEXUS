import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { USE_CASES } from '../../constants/dashboard';
import { borderRadius, colors, fontFamily } from '../../theme';

export function UseCaseBadges() {
  return (
    <View style={styles.row}>
      {USE_CASES.map((item) => (
        <View key={item.label} style={[styles.badge, item.primary && styles.primary]}>
          <Text style={[styles.text, item.primary && styles.primaryText]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.sm,
    paddingVertical: 5,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  primary: {
    borderColor: 'rgba(255,138,61,0.4)',
    backgroundColor: 'rgba(255,138,61,0.06)',
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.muted,
  },
  primaryText: {
    color: colors.amber,
  },
});
