import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Panel } from '../ui/Panel';
import { dashboardService } from '../../services/dashboardService';
import { useInterval } from '../../hooks/useInterval';
import { borderRadius, colors, fontFamily } from '../../theme';
import type { MetricsData } from '../../types/dashboard';

export function MetricsPanel() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const load = async () => setMetrics(await dashboardService.getMetrics());

  useEffect(() => {
    load().catch(console.error);
  }, []);
  useInterval(() => load().catch(console.error), 15000);

  const cards = useMemo((): [string, string][] => {
    if (!metrics) return [['-', 'Loading...']];
    const rag = metrics.retrieval_eval.rag;
    const base = metrics.retrieval_eval.baseline_keyword;
    return [
      [`${(rag.precision_at_1 * 100).toFixed(0)}%`, 'RAG Precision@1'],
      [`${(rag.recall_at_k * 100).toFixed(0)}%`, 'RAG Recall@3'],
      [`${(base.precision_at_1 * 100).toFixed(0)}%`, 'Baseline Precision@1'],
      [`${metrics.rca_pipeline_latency_ms.p50 ?? '-'}ms`, 'RCA Latency P50'],
    ];
  }, [metrics]);

  return (
    <Panel title="Evaluation Metrics" eyebrow="vs. naive keyword-search baseline">
      <View style={styles.grid}>
        {cards.map(([value, label]) => (
          <View style={styles.card} key={label}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    color: colors.cyan,
    marginBottom: 4,
  },
  label: {
    fontSize: 10.5,
    color: colors.muted,
    textAlign: 'center',
  },
});
