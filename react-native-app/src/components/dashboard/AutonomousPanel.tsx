import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { EmptyState } from '../ui/EmptyState';
import { FLOW_STATES, STAGE_ICON } from '../../constants/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import { useInterval } from '../../hooks/useInterval';
import { dashboardService } from '../../services/dashboardService';
import { formatTimeFromSeconds } from '../../utils/formatters';
import { borderRadius, colors, fontFamily } from '../../theme';

const STAGE_COLOR: Record<string, string> = {
  DETECTED: colors.red,
  DIAGNOSING: colors.cyan,
  FIXING: colors.amber,
  VALIDATING: colors.green,
  OPTIMIZING: colors.blue,
  SYSTEM: colors.muted,
};

export function AutonomousPanel() {
  const { autonomous, refreshAutonomous } = useDashboard();
  const [autoInject, setAutoInject] = useState(true);
  const [busy, setBusy] = useState(false);

  useInterval(() => refreshAutonomous().catch(console.error), 1500, true);

  const toggleAutonomous = useCallback(async () => {
    setBusy(true);
    try {
      if (autonomous.enabled) await dashboardService.stopAutonomous();
      else await dashboardService.startAutonomous(autoInject);
      await refreshAutonomous();
    } finally {
      setBusy(false);
    }
  }, [autoInject, autonomous.enabled, refreshAutonomous]);

  const log = autonomous.log ?? [];
  const reversedLog = log.slice().reverse();

  return (
    <Panel title="Autonomous Mode - Closed-Loop Agent" eyebrow="the AI runs the whole cycle itself" minHeight={520}>
      <Button
        variant={autonomous.enabled ? 'primary' : 'default'}
        onPress={toggleAutonomous}
        disabled={busy}
        style={styles.bigToggle}
      >
        {autonomous.enabled ? 'Autonomous Mode ENGAGED - tap to stop' : 'Engage Autonomous Mode'}
      </Button>
      <View style={styles.checkboxRow}>
        <Checkbox checked={autoInject} onChange={setAutoInject} label="auto-simulate field failures (walk-away demo)" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flowScroll} accessibilityLabel="Autonomous state flow">
        <View style={styles.flow}>
          {FLOW_STATES.map(([state, label], index) => (
            <React.Fragment key={state}>
              <View style={[styles.node, autonomous.state === state && styles.nodeActive]}>
                <Text style={[styles.nodeText, autonomous.state === state && styles.nodeTextActive]}>{label}</Text>
              </View>
              {index < FLOW_STATES.length - 1 ? <Text style={styles.arrow}>{'->'}</Text> : null}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.log} nestedScrollEnabled>
        {log.length === 0 ? (
          <EmptyState style={{ paddingVertical: 24 }}>
            {'// autonomous mode is off -\nclick "Engage Autonomous Mode" and the agent will detect,\ndiagnose, fix, validate, and optimize on its own.'}
          </EmptyState>
        ) : (
          reversedLog.map((entry, index) => (
            <View style={styles.logEntry} key={`${entry.ts}-${index}`}>
              <View style={styles.logHeadRow}>
                <Text style={styles.ts}>{formatTimeFromSeconds(entry.ts)}</Text>
                <View style={[styles.stageTag, { borderColor: STAGE_COLOR[entry.stage] ?? colors.muted }]}>
                  <Text style={[styles.stageTagText, { color: STAGE_COLOR[entry.stage] ?? colors.muted }]}>
                    {STAGE_ICON[entry.stage] ?? '*'} {entry.stage}
                  </Text>
                </View>
              </View>
              <Text style={styles.message}>{entry.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Panel>
  );
}

const styles = StyleSheet.create({
  bigToggle: {
    width: '100%',
  },
  checkboxRow: {
    marginTop: 12,
    marginBottom: 16,
  },
  flowScroll: {
    marginBottom: 16,
  },
  flow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  node: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  nodeActive: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(255,138,61,0.1)',
  },
  nodeText: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    color: colors.muted,
    letterSpacing: 0.4,
  },
  nodeTextActive: {
    color: colors.amber,
    fontWeight: '700',
  },
  arrow: {
    color: colors.muted,
    fontFamily: fontFamily.mono,
    fontSize: 12,
  },
  log: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  logEntry: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  logHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  ts: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: colors.muted,
  },
  stageTag: {
    borderWidth: 1,
    borderRadius: borderRadius.sm - 2,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  stageTagText: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 17,
  },
});
