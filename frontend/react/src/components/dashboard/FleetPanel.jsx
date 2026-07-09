import { memo, useEffect } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { useInterval } from '../../hooks/useInterval.js';
import styles from './FleetPanel.module.css';

function FleetCard({ asset, selected, busy, onSelect }) {
  return (
    <button type="button" className={`${styles.card} ${selected ? styles.selected : ''}`} onClick={() => onSelect(asset.asset_id)} aria-pressed={selected}>
      {busy ? <span className={styles.busy} title="agent is working on this asset" /> : null}
      <div className={styles.id}>{asset.asset_id}</div>
      <div className={styles.site}>{asset.site}</div>
      <span className={`${styles.status} status-${asset.status}`}>{asset.status}</span>
    </button>
  );
}

const MemoFleetCard = memo(FleetCard);

export function FleetPanel() {
  const { fleet, busyAssets, selectedAssetId, setSelectedAssetId, refreshFleet } = useDashboard();
  useEffect(() => { refreshFleet().catch(console.error); }, [refreshFleet]);
  useInterval(() => refreshFleet().catch(console.error), 2000);

  return (
    <Panel title="Fleet Overview - GOH-UC-065 Agentic Asset Management" eyebrow={`${fleet.length || 4} assets, monitored & acted on concurrently`}>
      <div className={styles.grid}>
        {fleet.map((asset) => (
          <MemoFleetCard
            key={asset.asset_id}
            asset={asset}
            selected={asset.asset_id === selectedAssetId}
            busy={busyAssets.includes(asset.asset_id)}
            onSelect={setSelectedAssetId}
          />
        ))}
      </div>
    </Panel>
  );
}
