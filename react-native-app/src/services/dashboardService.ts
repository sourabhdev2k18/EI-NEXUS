import { api, unwrap } from './api';
import type { Asset, AutonomousStatus, MetricsData, RcaResult, RoiData, Telemetry, ToolInfo, ProviderDiagnostics } from '../types/dashboard';

export const dashboardService = {
  getFleet: () => unwrap<Asset[]>(api.get('/fleet')),
  getTelemetry: (assetId: string) => unwrap<Telemetry>(api.get('/telemetry', { params: { asset_id: assetId } })),
  getMetrics: () => unwrap<MetricsData>(api.get('/metrics')),
  getTools: () => unwrap<Record<string, ToolInfo>>(api.get('/tools')),
  getRoi: () => unwrap<RoiData>(api.get('/roi')),
  getAutonomousStatus: () => unwrap<AutonomousStatus>(api.get('/autonomous/status')),
  startAutonomous: (autoInject: boolean) => unwrap(api.post('/autonomous/start', { auto_inject: autoInject })),
  stopAutonomous: () => unwrap(api.post('/autonomous/stop')),
  injectFault: ({ assetId, failureMode }: { assetId: string; failureMode: string }) =>
    unwrap(api.post('/inject_fault', { asset_id: assetId, failure_mode: failureMode })),
  applyFix: (assetId: string) => unwrap(api.post('/apply_fix', { asset_id: assetId })),
  resetFleet: () => unwrap(api.post('/reset')),
  analyzeRca: ({ query, useLlm }: { query: string; useLlm: boolean }) =>
    unwrap<RcaResult>(api.post('/analyze_rca', { query, use_llm: useLlm })),
  getGeminiStatus: () => unwrap<ProviderDiagnostics>(api.get('/gemini_status')),
  getOpenAiStatus: () => unwrap<ProviderDiagnostics>(api.get('/openai_status')),
};
