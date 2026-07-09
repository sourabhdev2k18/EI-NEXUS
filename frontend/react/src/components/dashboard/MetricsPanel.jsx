import { useEffect, useMemo, useState } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { dashboardService } from '../../services/dashboardService.js';
import { useInterval } from '../../hooks/useInterval.js';
import styles from './MetricsPanel.module.css';

export function MetricsPanel() {
  const [metrics, setMetrics] = useState(null);
  const load = async () => setMetrics(await dashboardService.getMetrics());
  useEffect(() => { load().catch(console.error); }, []);
  useInterval(() => load().catch(console.error), 15000);

  const cards = useMemo(() => {
    if (!metrics) return [['-', 'Loading...']];
    const rag = metrics.retrieval_eval.rag;
    const base = metrics.retrieval_eval.baseline_keyword;
    return [
      [`${(rag.precision_at_1 * 100).toFixed(0)}%`, 'RAG Precision@1'],
      [`${(rag.recall_at_k * 100).toFixed(0)}%`, 'RAG Recall@3'],
      [`${(base.precision_at_1 * 100).toFixed(0)}%`, 'Baseline Precision@1'],
      [`${metrics.rca_pipeline_latency_ms.p50 ?? '-'}ms`, 'RCA Latency P50']
    ];
  }, [metrics]);

  return (
    <Panel title="Evaluation Metrics" eyebrow="vs. naive keyword-search baseline">
      <div className={styles.grid}>
        {cards.map(([value, label]) => <div className={styles.card} key={label}><div className={styles.value}>{value}</div><div className={styles.label}>{label}</div></div>)}
      </div>
    </Panel>
  );
}
