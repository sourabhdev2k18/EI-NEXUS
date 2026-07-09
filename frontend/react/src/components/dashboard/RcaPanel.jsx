import { useCallback, useEffect, useState } from 'react';
import { Panel } from '../ui/Panel.jsx';
import { dashboardService } from '../../services/dashboardService.js';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { getProviderMeta, getTraceDetail } from '../../utils/trace.js';
import styles from './RcaPanel.module.css';

export function RcaPanel() {
  const { diagnostics, refreshDiagnostics, setLastRcaLatency } = useDashboard();
  const [query, setQuery] = useState('');
  const [useLlm, setUseLlm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState(null);
  const [error, setError] = useState('');

  const runRca = useCallback(async (overrideQuery = query) => {
    setLoading(true);
    setError('');
    setTraceData(null);
    try {
      const data = await dashboardService.analyzeRca({ query: overrideQuery.trim(), useLlm });
      await refreshDiagnostics();
      setTraceData(data);
      setLastRcaLatency(data.total_latency_ms);
    } catch (err) {
      setError(`Agent run failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [query, refreshDiagnostics, setLastRcaLatency, useLlm]);

  useEffect(() => {
    const handler = () => {
      setQuery('');
      runRca('');
    };
    window.addEventListener('ei:run-rca', handler);
    return () => window.removeEventListener('ei:run-rca', handler);
  }, [runRca]);

  return (
    <Panel title="MCP Root-Cause Agent - Live Reasoning Trace" eyebrow={traceData ? `total ${traceData.total_latency_ms} ms` : ''} minHeight={640}>
      <textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder='Describe the field failure in plain language, or leave blank to auto-analyze the live twin current anomaly... e.g. "motor controller running hot and shut itself down after 40 minutes"'
        aria-label="Root cause analysis query"
      />
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className={`primary ${styles.runButton}`} disabled={loading} onClick={() => runRca()}>
          <span className={styles.buttonIcon} aria-hidden="true">{loading ? '⏳' : '▶'}</span>{' '}
          {loading ? 'Running agent...' : 'Run 4-Tool MCP Agent'}
        </button>
        <label className="form-check">
          <input type="checkbox" checked={useLlm} onChange={(event) => setUseLlm(event.target.checked)} />
          use Gemini synthesis (if configured)
        </label>
      </div>
      {loading ? <div className={styles.statusLine}>Agent is querying the MCP tools and preparing the trace...</div> : null}

      <div className={styles.console}>
        {error ? <div className="empty-trace" style={{ color: 'var(--red)' }}>{error}</div> : null}
        {!error && !traceData ? <div className="empty-trace">// awaiting agent run -<br />click "Run 4-Tool MCP Agent" to trace a field failure<br />to its design root cause, live, with citations.</div> : null}
        {traceData?.trace?.map((step, index) => (
          <div className={styles.step} style={{ animationDelay: `${index * 0.12}s` }} key={`${step.step}-${step.tool}`}>
            <span className={styles.latency}>{step.latency_ms}ms</span>
            <div className={styles.title}>STEP {step.step} · {step.tool.toUpperCase()}</div>
            <div className={styles.thought}>{step.thought}</div>
            <div className={styles.detail}>
              {getTraceDetail(step).length ? getTraceDetail(step).map((line) => <div key={line}>{line}</div>) : <em>no matches</em>}
            </div>
          </div>
        ))}
      </div>
      {traceData ? <RcaReport data={traceData} diagnostics={diagnostics} /> : null}
    </Panel>
  );
}

function RcaReport({ data, diagnostics }) {
  const provider = getProviderMeta(data);
  const fallbackParts = [];
  if (provider.provider === 'rule_based') {
    if (diagnostics.gemini?.attempted) fallbackParts.push(`Gemini: ${diagnostics.gemini.http_status ? `HTTP ${diagnostics.gemini.http_status}: ` : ''}${diagnostics.gemini.error || 'unknown error'}`);
    if (diagnostics.openai?.attempted) fallbackParts.push(`GPT: ${diagnostics.openai.http_status ? `HTTP ${diagnostics.openai.http_status}: ` : ''}${diagnostics.openai.error || 'unknown error'}`);
  }

  return (
    <div className={styles.report}>
      <span className={`${styles.llmTag} ${styles[provider.className]}`}>{provider.label}</span>
      {fallbackParts.length ? <div className={styles.fallback}>{fallbackParts.join(' - ')}. Showing offline rule-based synthesis instead.</div> : null}
      {provider.provider === 'rule_based' && !diagnostics.gemini?.gemini_configured && !diagnostics.openai?.openai_configured ? <div className={styles.muted}>No GEMINI_API_KEY or OPENAI_API_KEY configured - see .env.example.</div> : null}
      <br />
      <strong>Inferred failure mode:</strong> {data.inferred_failure_mode} (confidence {(data.mode_confidence * 100).toFixed(0)}%)
      <br /><br />
      {data.synthesis}
      <br /><br />
      <strong className={styles.citationLabel}>Citations:</strong><br />
      {(data.citations ?? []).map((id) => <span className={styles.cite} key={id}>{id}</span>)}
    </div>
  );
}
