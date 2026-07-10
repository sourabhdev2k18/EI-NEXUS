// Ported from src/styles/theme.css (:root custom properties).
// RN has no CSS variables, so this is a plain object used everywhere via the theme index.
export const colors = {
  bg: '#0A0E13',
  panel: '#111820',
  panel2: '#161F29',
  line: '#232E3B',
  text: '#E7ECF2',
  muted: '#7C8A9A',
  amber: '#FF8A3D',
  amberDark: '#E8663A',
  green: '#3ED598',
  red: '#FF5C5C',
  cyan: '#4FD1E8',
  blue: '#5B8DEF',
  black: '#0A0E13',
} as const;

export const statusColors: Record<string, { bg: string; fg: string; border: string }> = {
  NOMINAL: { bg: 'rgba(62,213,152,0.12)', fg: colors.green, border: 'rgba(62,213,152,0.3)' },
  WARNING: { bg: 'rgba(255,138,61,0.12)', fg: colors.amber, border: 'rgba(255,138,61,0.3)' },
  CRITICAL: { bg: 'rgba(255,92,92,0.14)', fg: colors.red, border: 'rgba(255,92,92,0.35)' },
  RECOVERING: { bg: 'rgba(79,209,232,0.12)', fg: colors.cyan, border: 'rgba(79,209,232,0.3)' },
};

export const sensorSeverityColors: Record<'ok' | 'warn' | 'crit', string> = {
  ok: colors.text,
  warn: colors.amber,
  crit: colors.red,
};
