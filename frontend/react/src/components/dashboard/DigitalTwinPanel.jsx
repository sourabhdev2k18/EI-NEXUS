import { useCallback, useEffect, useMemo, useState } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { useInterval } from '../../hooks/useInterval.js';
import { dashboardService } from '../../services/dashboardService.js';
import { FAILURE_MODES, SENSOR_META } from '../../constants/dashboard.js';
import { getSensorSeverity } from '../../utils/sensors.js';
import { TelemetryChart } from './TelemetryChart.jsx';
import styles from './DigitalTwinPanel.module.css';

export function DigitalTwinPanel() {
  const { telemetry, selectedAssetId, refreshTelemetry } = useDashboard();
  const [failureMode, setFailureMode] = useState(FAILURE_MODES[0].value);
  const [busy, setBusy] = useState(false);

  useEffect(() => { refreshTelemetry().catch(console.error); }, [refreshTelemetry]);
  useInterval(() => refreshTelemetry().catch(console.error), selectedAssetId ? 1200 : null);

  const title = useMemo(() => {
    if (!telemetry) return `Digital Twin - ${selectedAssetId ?? 'loading...'}`;
    return `Digital Twin - ${telemetry.asset_id} - ${telemetry.site}`;
  }, [telemetry, selectedAssetId]);

  const runAction = useCallback(async (action) => {
    setBusy(true);
    try {
      await action();
      await refreshTelemetry();
    } finally {
      setBusy(false);
    }
  }, [refreshTelemetry]);

  const canInject = !telemetry?.active_fault && !busy && selectedAssetId;
  const canFix = telemetry?.active_fault && telemetry?.status !== 'RECOVERING' && !busy;

  return (
    <Panel title={title} eyebrow={<span className={`status-badge status-${telemetry?.status ?? 'NOMINAL'}`}>{telemetry?.status ?? 'NOMINAL'}</span>}>
      <div className={styles.sensorGrid}>
        {Object.entries(SENSOR_META).map(([key, meta]) => {
          const value = telemetry?.state?.[key] ?? 0;
          return (
            <div className={styles.sensor} key={key}>
              <div className={styles.label}>{meta.label}</div>
              <div className={`${styles.value} ${styles[getSensorSeverity(key, value)]}`}>
                {value.toFixed(1)} <span>{meta.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      <TelemetryChart history={telemetry?.history ?? []} />

      <div className="btn-row">
        <select value={failureMode} onChange={(event) => setFailureMode(event.target.value)} aria-label="Fault type">
          {FAILURE_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
        <button type="button" disabled={!canInject} onClick={() => runAction(() => dashboardService.injectFault({ assetId: selectedAssetId, failureMode }))}><span className={styles.buttonIcon} aria-hidden="true">⚠</span>Inject Fault</button>
        <button type="button" className="primary" disabled={!canFix} onClick={() => runAction(() => dashboardService.applyFix(selectedAssetId))}><span className={styles.buttonIcon} aria-hidden="true">✓</span>Apply Auto-Fix</button>
        <button type="button" className="ghost" onClick={() => window.dispatchEvent(new CustomEvent('ei:run-rca'))}><span className={styles.buttonIcon} aria-hidden="true">⌕</span>Analyze Root Cause</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => runAction(() => dashboardService.resetFleet())}><span className={styles.buttonIcon} aria-hidden="true">↺</span>Reset Fleet</button>
      </div>
    </Panel>
  );
}
