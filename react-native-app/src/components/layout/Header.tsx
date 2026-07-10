import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDashboard } from '../../context/DashboardContext';
import { StatusPill } from './StatusPill';
import { colors, fontFamily } from '../../theme';

// The web header used `position: sticky` + `backdrop-filter: blur`. RN has
// no CSS backdrop-filter, and this app doesn't need scroll-linked sticky
// behavior since it renders as the fixed, non-scrolling top bar of the
// screen (DashboardScreen puts the scrollable content below it), so a plain
// View with safe-area top padding is the direct equivalent.
export function Header() {
  const { diagnostics, telemetry } = useDashboard();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['rgba(17,24,32,0.95)', 'rgba(17,24,32,0.7)']} style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>EI</Text>
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.title} numberOfLines={1}>
            EI-Nexus <Text style={styles.titleMuted}>/ Autonomous Engineering Intelligence Twin</Text>
          </Text>
          <Text style={styles.tag} numberOfLines={2}>
            Team MCP Mavericks - GOH-UC-034 (Primary) - Big Bets: Energy & Automation + Digital Manufacturing
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <StatusPill type="gemini" data={diagnostics.gemini} />
        <StatusPill type="openai" data={diagnostics.openai} />
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: colors.green }]} />
          <Text style={styles.pillText}>
            Twin: <Text style={styles.mono}>{telemetry?.tick ?? 0}</Text> ticks
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontFamily: fontFamily.display,
    fontWeight: '700',
    color: colors.black,
    fontSize: 18,
  },
  brandTextWrap: {
    flexShrink: 1,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    color: colors.text,
  },
  titleMuted: {
    color: colors.muted,
    fontFamily: fontFamily.body,
    fontSize: 13,
    fontWeight: '400',
  },
  tag: {
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: colors.muted,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mono: {
    fontFamily: fontFamily.mono,
    color: colors.text,
  },
});
