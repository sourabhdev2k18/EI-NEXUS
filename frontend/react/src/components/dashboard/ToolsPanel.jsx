import { useEffect, useState } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { dashboardService } from '../../services/dashboardService.js';
import styles from './ToolsPanel.module.css';

export function ToolsPanel() {
  const [tools, setTools] = useState({});
  useEffect(() => { dashboardService.getTools().then(setTools).catch(console.error); }, []);
  return (
    <Panel title="4 MCP Tools" eyebrow="the reasoning trace, live ->">
      <div className={styles.list}>
        {Object.entries(tools).map(([name, tool], index) => (
          <div className={styles.card} key={name}>
            <div className={styles.num}>TOOL {index + 1}</div>
            <div className={styles.name}>{name}</div>
            <div className={styles.desc}>{tool.description}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
