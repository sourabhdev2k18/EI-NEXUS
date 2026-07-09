import { useDashboard } from '../../context/DashboardContext.jsx';
import styles from './Hero.module.css';

export function Hero() {
  const { lastRcaLatency } = useDashboard();
  return (
    <section className={styles.hero}>
      <div>
        <h2>Monitors. Predicts. Diagnoses. Fixes itself. Validates. Optimizes.</h2>
        <p>
          <em>"An agentic AI-powered digital twin that autonomously monitors industrial assets, predicts failures, performs root-cause analysis, orchestrates corrective actions using AI agents, validates recovery, and continuously optimizes operational performance."</em>
          <br /><br />
          Click <strong>Autonomous Mode</strong> below and step back - the agent runs the entire closed loop itself and narrates every stage live, so you can just point at the screen and explain what it is doing.
        </p>
      </div>
      <div className={styles.impactStat}>
        <div className={styles.big}>{lastRcaLatency ? `${lastRcaLatency} ms` : '-'}</div>
        <div className={styles.small}>avg RCA latency (this session)</div>
      </div>
    </section>
  );
}
