import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, fontFamily } from '../../theme';
import type { ProviderDiagnostics } from '../../types/dashboard';

interface StatusPillProps {
  type: 'gemini' | 'openai';
  data?: ProviderDiagnostics;
}

// `title` (a hover tooltip) has no direct mobile equivalent, so its content
// is exposed via accessibilityHint instead - a long-press with a screen
// reader announces it, and sighted users can tap the pill to see full detail
// (see the RcaPanel diagnostics fallback for where this detail also surfaces).
export function StatusPill({ type, data = {} }: StatusPillProps) {
  const isGemini = type === 'gemini';
  const configuredKey = isGemini ? 'gemini_configured' : 'openai_configured';
  const modeLabel = data.mode === 'azure_foundry' ? 'Azure AI Foundry' : 'public OpenAI';

  let label = isGemini ? 'checking Gemini...' : 'checking GPT...';
  let hint = '';
  let online = false;

  if ((data as any)[configuredKey] === false) {
    label = isGemini ? 'Gemini offline (no key set)' : 'GPT offline (no key set)';
    hint = isGemini ? 'No GEMINI_API_KEY found in the server environment.' : 'No AZURE_FOUNDRY_ENDPOINT or OPENAI_API_KEY found in the server environment.';
  } else if (data.attempted === false) {
    online = true;
    label = isGemini ? 'Gemini key set (not tested yet)' : `GPT set (${modeLabel}, not tested yet)`;
  } else if (data.ok) {
    online = true;
    label = isGemini ? 'Gemini connected' : `GPT connected (${modeLabel})`;
    hint = 'Last call succeeded.';
  } else if (data.error) {
    label = isGemini ? 'Gemini call failing - see details' : 'GPT call failing - see details';
    hint = `${data.http_status ? `HTTP ${data.http_status}: ` : ''}${data.error}`;
  }

  return (
    <View style={styles.pill} accessibilityLabel={label} accessibilityHint={hint || undefined}>
      <View style={[styles.dot, { backgroundColor: online ? colors.green : colors.red }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: colors.muted,
  },
});
