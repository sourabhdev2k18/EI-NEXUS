export type AssetStatus = 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'RECOVERING';

export interface Asset {
  asset_id: string;
  site: string;
  status: AssetStatus;
}

export interface TelemetryHistoryPoint {
  t: number;
  temperature: number;
  vibration: number;
  voltage: number;
  current: number;
}

export interface SensorState {
  temperature: number;
  vibration: number;
  load: number;
  voltage: number;
  current: number;
  fan_speed: number;
}

export interface Telemetry {
  asset_id: string;
  site: string;
  status: AssetStatus;
  tick: number;
  active_fault: boolean;
  state: SensorState;
  history: TelemetryHistoryPoint[];
}

export interface AutonomousLogEntry {
  ts: number;
  stage: 'DETECTED' | 'DIAGNOSING' | 'FIXING' | 'VALIDATING' | 'OPTIMIZING' | 'SYSTEM';
  message: string;
}

export interface AutonomousStatus {
  enabled: boolean;
  state: string;
  log: AutonomousLogEntry[];
  busy_assets?: string[];
}

export interface ProviderDiagnostics {
  gemini_configured?: boolean;
  openai_configured?: boolean;
  attempted?: boolean;
  ok?: boolean;
  error?: string;
  http_status?: number;
  mode?: string;
}

export interface Diagnostics {
  gemini: ProviderDiagnostics;
  openai: ProviderDiagnostics;
}

export interface TraceStep {
  step: number;
  tool: string;
  thought: string;
  latency_ms: number;
  output?: { results?: any[] };
}

export interface RcaResult {
  trace: TraceStep[];
  total_latency_ms: number;
  inferred_failure_mode: string;
  mode_confidence: number;
  synthesis: string;
  citations?: string[];
  llm_used?: boolean;
  llm_provider?: 'gemini' | 'openai' | 'rule_based';
}

export interface RoiData {
  total_savings_usd: number;
  incidents_resolved: number;
  avg_resolution_seconds: number;
  assumptions: {
    traditional_rca_hours: number;
    downtime_cost_per_hour_usd: number;
    engineer_loaded_cost_per_hour_usd: number;
  };
}

export interface MetricsData {
  retrieval_eval: {
    rag: { precision_at_1: number; recall_at_k: number };
    baseline_keyword: { precision_at_1: number; recall_at_k: number };
  };
  rca_pipeline_latency_ms: { p50?: number };
}

export interface ToolInfo {
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  used_llm?: boolean;
}
