import { api, unwrap } from './api.js';

export const dashboardService = {
  getFleet: () => unwrap(api.get('/fleet')),
  getTelemetry: (assetId) => unwrap(api.get('/telemetry', { params: { asset_id: assetId } })),
  getMetrics: () => unwrap(api.get('/metrics')),
  getTools: () => unwrap(api.get('/tools')),
  getRoi: () => unwrap(api.get('/roi')),
  getAutonomousStatus: () => unwrap(api.get('/autonomous/status')),
  startAutonomous: (autoInject) => unwrap(api.post('/autonomous/start', { auto_inject: autoInject })),
  stopAutonomous: () => unwrap(api.post('/autonomous/stop')),
  injectFault: ({ assetId, failureMode }) => unwrap(api.post('/inject_fault', { asset_id: assetId, failure_mode: failureMode })),
  applyFix: (assetId) => unwrap(api.post('/apply_fix', { asset_id: assetId })),
  resetFleet: () => unwrap(api.post('/reset')),
  analyzeRca: ({ query, useLlm }) => unwrap(api.post('/analyze_rca', { query, use_llm: useLlm })),
  getGeminiStatus: () => unwrap(api.get('/gemini_status')),
  getOpenAiStatus: () => unwrap(api.get('/openai_status'))
};
