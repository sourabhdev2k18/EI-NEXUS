import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useDashboard } from '../../context/DashboardContext';
import { colors, fontFamily } from '../../theme';

export function Hero() {
  const { lastRcaLatency } = useDashboard();
  const { width } = useWindowDimensions();
  const isNarrow = width < 480;

  return (
    <View style={[styles.hero, isNarrow && styles.heroNarrow]}>
      <View style={styles.copy}>
        <Text style={styles.heading}>Monitors. Predicts. Diagnoses. Fixes itself. Validates. Optimizes.</Text>
        <Text style={styles.body}>
          <Text style={styles.emphasis}>
            "An agentic AI-powered digital twin that autonomously monitors industrial assets, predicts failures,
            performs root-cause analysis, orchestrates corrective actions using AI agents, validates recovery, and
            continuously optimizes operational performance."
          </Text>
          {'\n\n'}
          Click <Text style={styles.strong}>Autonomous Mode</Text> below and step back - the agent runs the entire
          closed loop itself and narrates every stage live, so you can just point at the screen and explain what it
          is doing.
        </Text>
      </View>
      <View style={[styles.impactStat, isNarrow && styles.impactStatNarrow]}>
        <Text style={styles.big}>{lastRcaLatency ? `${lastRcaLatency} ms` : '-'}</Text>
        <Text style={styles.small}>avg RCA latency (this session)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 24,
    marginBottom: 22,
    flexWrap: 'wrap',
  },
  heroNarrow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    minWidth: 240,
  },
  heading: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 640,
  },
  emphasis: {
    color: colors.text,
    fontStyle: 'italic',
  },
  strong: {
    color: colors.amber,
    fontWeight: '700',
  },
  impactStat: {
    alignItems: 'flex-end',
  },
  impactStatNarrow: {
    alignItems: 'flex-start',
    marginTop: 12,
  },
  big: {
    fontFamily: fontFamily.mono,
    fontSize: 26,
    color: colors.amber,
    fontWeight: '700',
  },
  small: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
