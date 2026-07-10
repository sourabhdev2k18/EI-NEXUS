import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { useDashboard } from '../../context/DashboardContext';
import { useInterval } from '../../hooks/useInterval';
import { dashboardService } from '../../services/dashboardService';
import { FAILURE_MODES, SENSOR_META } from '../../constants/dashboard';
import { getSensorSeverity } from '../../utils/sensors';
import { TelemetryChart } from './TelemetryChart';
import { borderRadius, colors, fontFamily, sensorSeverityColors } from '../../theme';

// The web <select> for fault type had only 4 short options, so on mobile a
// horizontal row of pressable chips (like a segmented control) is more
// thumb-friendly than opening a native picker sheet for such a short list.
export function DigitalTwinPanel() {
  const { telemetry, selectedAssetId, refreshTelemetry, triggerRca } = useDashboard();
  const [failureMode, setFailureMode] = useState(FAILURE_MODES[0].value);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshTelemetry().catch(console.error);
  }, [refreshTelemetry]);
  useInterval(() => refreshTelemetry().catch(console.error), selectedAssetId ? 1200 : null);

  const title = useMemo(() => {
    if (!telemetry) return `Digital Twin - ${selectedAssetId ?? 'loading...'}`;
    return `Digital Twin - ${telemetry.asset_id} - ${telemetry.site}`;
  }, [telemetry, selectedAssetId]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        await refreshTelemetry();
      } finally {
        setBusy(false);
      }
    },
    [refreshTelemetry]
  );

  const canInject = !telemetry?.active_fault && !busy && !!selectedAssetId;
  const canFix = telemetry?.active_fault && telemetry?.status !== 'RECOVERING' && !busy;

  return (
    <Panel title={title} eyebrow={<StatusBadge status={telemetry?.status ?? 'NOMINAL'} />} minHeight={560}>
      <View style={styles.sensorGrid}>
        {Object.entries(SENSOR_META).map(([key, meta]) => {
          const value = (telemetry?.state as any)?.[key] ?? 0;
          const severity = getSensorSeverity(key as any, value);
          return (
            <View style={styles.sensor} key={key}>
              <Text style={styles.label}>{meta.label}</Text>
              <Text style={[styles.value, { color: sensorSeverityColors[severity] }]}>
                {value.toFixed(1)} <Text style={styles.unit}>{meta.unit}</Text>
              </Text>
            </View>
          );
        })}
      </View>

      <TelemetryChart history={telemetry?.history ?? []} />

      <View style={styles.chipRow}>
        {FAILURE_MODES.map((mode) => (
          <Pressable
            key={mode.value}
            onPress={() => setFailureMode(mode.value)}
            style={[styles.chip, failureMode === mode.value && styles.chipActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: failureMode === mode.value }}
          >
            <Text style={[styles.chipText, failureMode === mode.value && styles.chipTextActive]}>{mode.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
        <Button
          disabled={!canInject}
          onPress={() => runAction(() => dashboardService.injectFault({ assetId: selectedAssetId!, failureMode }))}
        >
          Inject Fault
        </Button>
        <Button
          variant="primary"
          disabled={!canFix}
          onPress={() => runAction(() => dashboardService.applyFix(selectedAssetId!))}
        >
          Apply Auto-Fix
        </Button>
        <Button variant="ghost" onPress={triggerRca}>
          Analyze Root Cause
        </Button>
        <Button variant="ghost" disabled={busy} onPress={() => runAction(() => dashboardService.resetFleet())}>
          Reset Fleet
        </Button>
      </ScrollView>
    </Panel>
  );
}

const styles = StyleSheet.create({
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  sensor: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  unit: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipActive: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(255,138,61,0.08)',
  },
  chipText: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.amber,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingVertical: 2,
  },
});
