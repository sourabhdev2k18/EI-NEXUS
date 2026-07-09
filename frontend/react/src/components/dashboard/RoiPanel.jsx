import { useEffect, useState } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { dashboardService } from '../../services/dashboardService.js';
import { useInterval } from '../../hooks/useInterval.js';
import { formatCurrency } from '../../utils/formatters.js';
import styles from './RoiPanel.module.css';

export function RoiPanel() {
  const [roi, setRoi] = useState(null);
  const load = async () => setRoi(await dashboardService.getRoi());
  useEffect(() => { load().catch(console.error); }, []);
  useInterval(() => load().catch(console.error), 4000);

  const cards = roi ? [
    [formatCurrency(roi.total_savings_usd), 'Est. Total Savings'],
    [roi.incidents_resolved, 'Incidents Resolved'],
    [`${roi.avg_resolution_seconds}s`, 'Avg Resolution Time']
  ] : [['$0', 'Est. Savings']];

  return (
    <Panel title="Live Business Impact" eyebrow="computed from this session's resolved incidents">
      <div className={styles.grid}>
        {cards.map(([value, label]) => <div className={styles.card} key={label}><div className={styles.value}>{value}</div><div className={styles.label}>{label}</div></div>)}
      </div>
      <div className={styles.note}>
        {roi?.incidents_resolved > 0
          ? `Assumptions: traditional RCA ~= ${roi.assumptions.traditional_rca_hours}hrs (2 weeks) vs. actual session time - downtime cost $${roi.assumptions.downtime_cost_per_hour_usd}/hr - engineer time $${roi.assumptions.engineer_loaded_cost_per_hour_usd}/hr loaded - adjustable in backend/metrics.py`
          : 'No incidents resolved yet this session - engage Autonomous Mode to start generating impact numbers.'}
      </div>
    </Panel>
  );
}
