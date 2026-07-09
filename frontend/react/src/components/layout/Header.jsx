import styles from './Header.module.css';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { StatusPill } from './StatusPill.jsx';

export function Header() {
  const { diagnostics, telemetry } = useDashboard();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>EI</div>
        <div>
          <h1>EI-Nexus <span>/ Autonomous Engineering Intelligence Twin</span></h1>
          <div className={styles.tag}>Team MCP Mavericks - GOH-UC-034 (Primary) - Big Bets: Energy & Automation + Digital Manufacturing</div>
        </div>
      </div>
      <div className={styles.right}>
        <StatusPill type="gemini" data={diagnostics.gemini} />
        <StatusPill type="openai" data={diagnostics.openai} />
        <div className={styles.pill}><span className={`${styles.dot} ${styles.on}`} />Twin: <span className="mono">{telemetry?.tick ?? 0}</span> ticks</div>
      </div>
    </header>
  );
}
