import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { EmptyState } from '../ui/EmptyState';
import { dashboardService } from '../../services/dashboardService';
import { useDashboard } from '../../context/DashboardContext';
import { getProviderMeta, getTraceDetail } from '../../utils/trace';
import { borderRadius, colors, fontFamily } from '../../theme';
import type { Diagnostics, RcaResult } from '../../types/dashboard';

const PROVIDER_COLOR: Record<string, string> = {
  gemini: colors.blue,
  openai: colors.green,
  rule_based: colors.muted,
};

export function RcaPanel() {
  const { diagnostics, refreshDiagnostics, setLastRcaLatency, rcaTrigger } = useDashboard();
  const [query, setQuery] = useState('');
  const [useLlm, setUseLlm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState<RcaResult | null>(null);
  const [error, setError] = useState('');

  const runRca = useCallback(
    async (overrideQuery = query) => {
      setLoading(true);
      setError('');
      setTraceData(null);
      try {
        const data = await dashboardService.analyzeRca({ query: overrideQuery.trim(), useLlm });
        await refreshDiagnostics();
        setTraceData(data);
        setLastRcaLatency(data.total_latency_ms);
      } catch (err: any) {
        setError(`Agent run failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [query, refreshDiagnostics, setLastRcaLatency, useLlm]
  );

  // Replaces window.addEventListener('ei:run-rca', ...): DigitalTwinPanel's
  // "Analyze Root Cause" button bumps rcaTrigger in shared context instead
  // of dispatching a DOM CustomEvent (RN has neither window nor CustomEvent).
  const isFirstRun = React.useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setQuery('');
    runRca('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcaTrigger]);

  return (
    <Panel
      title="MCP Root-Cause Agent - Live Reasoning Trace"
      eyebrow={traceData ? `total ${traceData.total_latency_ms} ms` : ''}
      minHeight={640}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder='Describe the field failure in plain language, or leave blank to auto-analyze the live twin current anomaly... e.g. "motor controller running hot and shut itself down after 40 minutes"'
        placeholderTextColor={colors.muted}
        multiline
        numberOfLines={4}
        style={styles.textarea}
        accessibilityLabel="Root cause analysis query"
      />
      <View style={styles.btnRow}>
        <Button variant="primary" disabled={loading} loading={loading} onPress={() => runRca()}>
          {loading ? 'Running agent...' : 'Run 4-Tool MCP Agent'}
        </Button>
        <Checkbox checked={useLlm} onChange={setUseLlm} label="use Gemini synthesis (if configured)" />
      </View>
      {loading ? <Text style={styles.statusLine}>Agent is querying the MCP tools and preparing the trace...</Text> : null}

      <View style={styles.console}>
        {error ? <EmptyState color={colors.red}>{error}</EmptyState> : null}
        {!error && !traceData ? (
          <EmptyState>
            {'// awaiting agent run -\nclick "Run 4-Tool MCP Agent" to trace a field failure\nto its design root cause, live, with citations.'}
          </EmptyState>
        ) : null}
        {traceData?.trace?.map((step) => {
          const detail = getTraceDetail(step);
          return (
            <View style={styles.step} key={`${step.step}-${step.tool}`}>
              <Text style={styles.latency}>{step.latency_ms}ms</Text>
              <Text style={styles.stepTitle}>
                STEP {step.step} - {step.tool.toUpperCase()}
              </Text>
              <Text style={styles.thought}>{step.thought}</Text>
              <View style={styles.detail}>
                {detail.length ? (
                  detail.map((line) => (
                    <Text key={line} style={styles.detailLine}>
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.detailEmpty}>no matches</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      {traceData ? <RcaReport data={traceData} diagnostics={diagnostics} /> : null}
    </Panel>
  );
}

function RcaReport({ data, diagnostics }: { data: RcaResult; diagnostics: Diagnostics }) {
  const provider = getProviderMeta(data);
  const fallbackParts: string[] = [];
  if (provider.provider === 'rule_based') {
    if (diagnostics.gemini?.attempted) {
      fallbackParts.push(`Gemini: ${diagnostics.gemini.http_status ? `HTTP ${diagnostics.gemini.http_status}: ` : ''}${diagnostics.gemini.error || 'unknown error'}`);
    }
    if (diagnostics.openai?.attempted) {
      fallbackParts.push(`GPT: ${diagnostics.openai.http_status ? `HTTP ${diagnostics.openai.http_status}: ` : ''}${diagnostics.openai.error || 'unknown error'}`);
    }
  }

  return (
    <View style={styles.report}>
      <View style={[styles.llmTag, { borderColor: PROVIDER_COLOR[provider.provider] }]}>
        <Text style={[styles.llmTagText, { color: PROVIDER_COLOR[provider.provider] }]}>{provider.label}</Text>
      </View>
      {fallbackParts.length ? (
        <Text style={styles.fallback}>{fallbackParts.join(' - ')}. Showing offline rule-based synthesis instead.</Text>
      ) : null}
      {provider.provider === 'rule_based' && !diagnostics.gemini?.gemini_configured && !diagnostics.openai?.openai_configured ? (
        <Text style={styles.muted}>No GEMINI_API_KEY or OPENAI_API_KEY configured - see .env.example.</Text>
      ) : null}
      <Text style={styles.reportBody}>
        <Text style={styles.strong}>Inferred failure mode: </Text>
        {data.inferred_failure_mode} (confidence {(data.mode_confidence * 100).toFixed(0)}%)
        {'\n\n'}
        {data.synthesis}
      </Text>
      <Text style={styles.citationLabel}>Citations:</Text>
      <View style={styles.citeRow}>
        {(data.citations ?? []).map((id) => (
          <View style={styles.cite} key={id}>
            <Text style={styles.citeText}>{id}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textarea: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: colors.text,
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },
  statusLine: {
    marginTop: 10,
    fontFamily: fontFamily.mono,
    fontSize: 11.5,
    color: colors.cyan,
  },
  console: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.15)',
    minHeight: 120,
  },
  step: {
    padding: 12,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    position: 'relative',
  },
  latency: {
    position: 'absolute',
    top: 8,
    right: 12,
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: colors.muted,
  },
  stepTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.amber,
    marginBottom: 4,
  },
  thought: {
    fontSize: 12.5,
    color: colors.text,
    marginBottom: 6,
    lineHeight: 18,
  },
  detail: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: borderRadius.sm,
    padding: 8,
    gap: 3,
  },
  detailLine: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.muted,
  },
  detailEmpty: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: colors.muted,
    fontStyle: 'italic',
  },
  report: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    padding: 14,
    backgroundColor: 'rgba(255,138,61,0.03)',
  },
  llmTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  llmTagText: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: '700',
  },
  fallback: {
    fontSize: 11.5,
    color: colors.amber,
    marginBottom: 8,
  },
  muted: {
    fontSize: 11.5,
    color: colors.muted,
    marginBottom: 8,
  },
  reportBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  strong: {
    fontWeight: '700',
    color: colors.text,
  },
  citationLabel: {
    marginTop: 14,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 6,
  },
  citeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cite: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  citeText: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    color: colors.cyan,
  },
});
