import { useCallback, useState } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { FLOW_STATES } from '../../constants/dashboard.js';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { useInterval } from '../../hooks/useInterval.js';
import { dashboardService } from '../../services/dashboardService.js';
import { formatTimeFromSeconds } from '../../utils/formatters.js';
import styles from './AutonomousPanel.module.css';

const STAGE_ICON = { DETECTED: '!', DIAGNOSING: 'SEARCH', FIXING: 'FIX', VALIDATING: 'OK', OPTIMIZING: 'UP', SYSTEM: 'SYS' };

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

  return (
    <Panel title="Autonomous Mode - Closed-Loop Agent" eyebrow="the AI runs the whole cycle itself" className={styles.panel}>
      <div className={styles.toggleRow}>
        <button type="button" className={`${styles.bigToggle} ${autonomous.enabled ? styles.on : ''}`} onClick={toggleAutonomous} disabled={busy}>
          <span className={styles.statusDot} />
          {autonomous.enabled ? 'Autonomous Mode ENGAGED - click to stop' : 'Engage Autonomous Mode'}
        </button>
        <label className="form-check">
          <input type="checkbox" checked={autoInject} onChange={(event) => setAutoInject(event.target.checked)} />
          auto-simulate field failures (walk-away demo)
        </label>
      </div>

      <div className={styles.flow} aria-label="Autonomous state flow">
        {FLOW_STATES.map(([state, label], index) => (
          <span key={state} className={styles.flowPair}>
            <span className={`${styles.node} ${autonomous.state === state ? styles.active : ''}`}>{label}</span>
            {index < FLOW_STATES.length - 1 ? <span className={styles.arrow}>-&gt;</span> : null}
          </span>
        ))}
      </div>

      <div className={styles.log}>
        {(autonomous.log ?? []).length === 0 ? (
          <div className="empty-trace" style={{ padding: '24px 10px' }}>
            // autonomous mode is off -<br />click "Engage Autonomous Mode" and the agent will detect,<br />diagnose, fix, validate, and optimize on its own.
          </div>
        ) : autonomous.log.slice().reverse().map((entry, index) => (
          <div className={styles.logEntry} key={`${entry.ts}-${index}`}>
            <span className={styles.ts}>{formatTimeFromSeconds(entry.ts)}</span>
            <span className={`${styles.stageTag} ${styles[`stage${entry.stage}`]}`}>{STAGE_ICON[entry.stage] ?? '*'} {entry.stage}</span>
            {entry.message}
          </div>
        ))}
      </div>
    </Panel>
  );
}
