import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { dashboardService } from '../services/dashboardService.js';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [busyAssets, setBusyAssets] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [autonomous, setAutonomous] = useState({ enabled: false, state: 'MONITORING', log: [] });
  const [diagnostics, setDiagnostics] = useState({ gemini: {}, openai: {} });
  const [lastRcaLatency, setLastRcaLatency] = useState(null);

  const refreshFleet = useCallback(async () => {
    const [assets, autoStatus] = await Promise.all([
      dashboardService.getFleet(),
      dashboardService.getAutonomousStatus()
    ]);
    setFleet(assets);
    setBusyAssets(autoStatus.busy_assets ?? []);
    setAutonomous(autoStatus);
    setSelectedAssetId((current) => current ?? assets?.[0]?.asset_id ?? null);
  }, []);

  const refreshTelemetry = useCallback(async () => {
    if (!selectedAssetId) return null;
    const data = await dashboardService.getTelemetry(selectedAssetId);
    setTelemetry(data);
    return data;
  }, [selectedAssetId]);

  const refreshAutonomous = useCallback(async () => {
    const status = await dashboardService.getAutonomousStatus();
    setAutonomous(status);
    setBusyAssets(status.busy_assets ?? []);
    return status;
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    const [gemini, openai] = await Promise.allSettled([
      dashboardService.getGeminiStatus(),
      dashboardService.getOpenAiStatus()
    ]);
    const next = {
      gemini: gemini.status === 'fulfilled' ? gemini.value : {},
      openai: openai.status === 'fulfilled' ? openai.value : {}
    };
    setDiagnostics(next);
    return next;
  }, []);

  const value = useMemo(() => ({
    selectedAssetId,
    setSelectedAssetId,
    fleet,
    busyAssets,
    telemetry,
    autonomous,
    diagnostics,
    lastRcaLatency,
    setLastRcaLatency,
    refreshFleet,
    refreshTelemetry,
    refreshAutonomous,
    refreshDiagnostics
  }), [selectedAssetId, fleet, busyAssets, telemetry, autonomous, diagnostics, lastRcaLatency, refreshFleet, refreshTelemetry, refreshAutonomous, refreshDiagnostics]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used inside DashboardProvider');
  return context;
}
