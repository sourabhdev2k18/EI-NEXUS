import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { borderRadius, fontFamily, statusColors } from '../../theme';
import type { AssetStatus } from '../../types/dashboard';

interface StatusBadgeProps {
  status: AssetStatus;
}

// Ports the .status-NOMINAL / .status-WARNING / .status-CRITICAL / .status-RECOVERING
// classes from base.css. CRITICAL had a CSS `pulse` keyframe animation, which
// we reproduce with the RN Animated API.
export function StatusBadge({ status }: StatusBadgeProps) {
  const palette = statusColors[status] ?? statusColors.NOMINAL;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'CRITICAL') {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: pulse },
      ]}
    >
      <Text style={[styles.text, { color: palette.fg }]}>{status}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
