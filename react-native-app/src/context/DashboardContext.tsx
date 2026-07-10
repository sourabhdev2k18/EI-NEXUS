import React, { createContext, useCallback, useContext, useMemo, useState, PropsWithChildren } from 'react';
import { dashboardService } from '../services/dashboardService';
import type { Asset, AutonomousStatus, Diagnostics, Telemetry } from '../types/dashboard';

interface DashboardContextValue {
  selectedAssetId: string | null;
  setSelectedAssetId: React.Dispatch<React.SetStateAction<string | null>>;
  fleet: Asset[];
  busyAssets: string[];
  telemetry: Telemetry | null;
  autonomous: AutonomousStatus;
  diagnostics: Diagnostics;
  lastRcaLatency: number | null;
  setLastRcaLatency: React.Dispatch<React.SetStateAction<number | null>>;
  rcaTrigger: number;
  triggerRca: () => void;
  refreshFleet: () => Promise<void>;
  refreshTelemetry: () => Promise<Telemetry | null>;
  refreshAutonomous: () => Promise<AutonomousStatus>;
  refreshDiagnostics: () => Promise<Diagnostics>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: PropsWithChildren) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [fleet, setFleet] = useState<Asset[]>([]);
  const [busyAssets, setBusyAssets] = useState<string[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [autonomous, setAutonomous] = useState<AutonomousStatus>({ enabled: false, state: 'MONITORING', log: [] });
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({ gemini: {}, openai: {} });
  const [lastRcaLatency, setLastRcaLatency] = useState<number | null>(null);
  // Replaces window.dispatchEvent(new CustomEvent('ei:run-rca')) from the web
  // app: DigitalTwinPanel's "Analyze Root Cause" button used a DOM custom
  // event to tell the (unrelated, sibling) RcaPanel to kick off a run. RN
  // has no window/CustomEvent, so we use a simple incrementing token in
  // shared context instead - RcaPanel watches it with useEffect.
  const [rcaTrigger, setRcaTrigger] = useState(0);
  const triggerRca = useCallback(() => setRcaTrigger((n) => n + 1), []);

  const refreshFleet = useCallback(async () => {
    const [assets, autoStatus] = await Promise.all([dashboardService.getFleet(), dashboardService.getAutonomousStatus()]);
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
    const [gemini, openai] = await Promise.allSettled([dashboardService.getGeminiStatus(), dashboardService.getOpenAiStatus()]);
    const next: Diagnostics = {
      gemini: gemini.status === 'fulfilled' ? gemini.value : {},
      openai: openai.status === 'fulfilled' ? openai.value : {},
    };
    setDiagnostics(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({
      selectedAssetId,
      setSelectedAssetId,
      fleet,
      busyAssets,
      telemetry,
      autonomous,
      diagnostics,
      lastRcaLatency,
      setLastRcaLatency,
      rcaTrigger,
      triggerRca,
      refreshFleet,
      refreshTelemetry,
      refreshAutonomous,
      refreshDiagnostics,
    }),
    [selectedAssetId, fleet, busyAssets, telemetry, autonomous, diagnostics, lastRcaLatency, rcaTrigger, triggerRca, refreshFleet, refreshTelemetry, refreshAutonomous, refreshDiagnostics]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used inside DashboardProvider');
  return context;
}
