import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardProvider } from '../context/DashboardContext';
import { Header } from '../components/layout/Header';
import { Hero } from '../components/dashboard/Hero';
import { UseCaseBadges } from '../components/dashboard/UseCaseBadges';
import { FleetPanel } from '../components/dashboard/FleetPanel';
import { DigitalTwinPanel } from '../components/dashboard/DigitalTwinPanel';
import { AutonomousPanel } from '../components/dashboard/AutonomousPanel';
import { RoiPanel } from '../components/dashboard/RoiPanel';
import { MetricsPanel } from '../components/dashboard/MetricsPanel';
import { ToolsPanel } from '../components/dashboard/ToolsPanel';
import { RcaPanel } from '../components/dashboard/RcaPanel';
import { AriaChatWidget } from '../components/chat/AriaChatWidget';
import { colors, fontFamily } from '../theme';

// The web app used document.title / meta description via a <Seo> Helmet
// component for the '/' route. RN screens have no <head>; the equivalent is
// setting options={{ title: ... }} on the React Navigation stack screen
// (already wired in navigation/AppNavigator.tsx) since header is hidden here
// there is nothing further to port.
function DashboardContent() {
  const { width } = useWindowDimensions();
  // Desktop CSS grid was `1.15fr 1fr` (main column slightly wider than the
  // RCA column), collapsing to a single column under 1080px. On a phone
  // there's no room for two columns at all, so everything stacks in one
  // scrollable column; on wider (tablet) viewports we restore the 2-column
  // layout since there's room for it.
  const isWide = width >= 900;

  const mainPanels = (
    <>
      <FleetPanel />
      <DigitalTwinPanel />
      <AutonomousPanel />
      <RoiPanel />
      <MetricsPanel />
      <ToolsPanel />
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Hero />
      <UseCaseBadges />
      {isWide ? (
        <View style={styles.grid}>
          <View style={styles.mainCol}>{mainPanels}</View>
          <View style={styles.sideCol}>
            <RcaPanel />
          </View>
        </View>
      ) : (
        <View>
          {mainPanels}
          <RcaPanel />
        </View>
      )}
      <Text style={styles.footer}>
        EI-Nexus RCA - offline-first - Gemini-optional - built for LTTS OpenHack 2026 - Big Bet 3 (Energy & Digital
        Manufacturing) x Big Bet 5/6 (AI Infra Self-Diagnosis / MCP Copilot)
      </Text>
    </ScrollView>
  );
}

export function DashboardScreen() {
  return (
    <DashboardProvider>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <Header />
        <DashboardContent />
        <AriaChatWidget />
      </SafeAreaView>
    </DashboardProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    gap: 18,
  },
  mainCol: {
    flex: 1.15,
  },
  sideCol: {
    flex: 1,
  },
  footer: {
    marginTop: 10,
    fontSize: 10.5,
    color: colors.muted,
    fontFamily: fontFamily.mono,
    textAlign: 'center',
    lineHeight: 15,
  },
});
