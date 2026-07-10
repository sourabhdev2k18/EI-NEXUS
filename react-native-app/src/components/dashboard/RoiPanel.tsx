import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Panel } from '../ui/Panel';
import { dashboardService } from '../../services/dashboardService';
import { useInterval } from '../../hooks/useInterval';
import { formatCurrency } from '../../utils/formatters';
import { borderRadius, colors, fontFamily } from '../../theme';
import type { RoiData } from '../../types/dashboard';

export function RoiPanel() {
  const [roi, setRoi] = useState<RoiData | null>(null);
  const load = async () => setRoi(await dashboardService.getRoi());

  useEffect(() => {
    load().catch(console.error);
  }, []);
  useInterval(() => load().catch(console.error), 4000);

  const cards: [string | number, string][] = roi
    ? [
        [formatCurrency(roi.total_savings_usd), 'Est. Total Savings'],
        [roi.incidents_resolved, 'Incidents Resolved'],
        [`${roi.avg_resolution_seconds}s`, 'Avg Resolution Time'],
      ]
    : [['$0', 'Est. Savings']];

  return (
    <Panel title="Live Business Impact" eyebrow="computed from this session's resolved incidents">
      <View style={styles.grid}>
        {cards.map(([value, label]) => (
          <View style={styles.card} key={label}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        {roi && roi.incidents_resolved > 0
          ? `Assumptions: traditional RCA ~= ${roi.assumptions.traditional_rca_hours}hrs (2 weeks) vs. actual session time - downtime cost $${roi.assumptions.downtime_cost_per_hour_usd}/hr - engineer time $${roi.assumptions.engineer_loaded_cost_per_hour_usd}/hr loaded - adjustable in backend/metrics.py`
          : 'No incidents resolved yet this session - engage Autonomous Mode to start generating impact numbers.'}
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  card: {
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  value: {
    fontFamily: fontFamily.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.green,
    marginBottom: 4,
  },
  label: {
    fontSize: 10.5,
    color: colors.muted,
    textAlign: 'center',
  },
  note: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
  },
});
