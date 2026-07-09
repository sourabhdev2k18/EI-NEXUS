import { SENSOR_META } from '../constants/dashboard.js';

export function getSensorSeverity(key, value) {
  const meta = SENSOR_META[key];
  if (!meta || meta.warn === 999 || typeof value !== 'number') return 'ok';
  if (meta.inverse) {
    if (value <= meta.crit) return 'crit';
    if (value <= meta.warn) return 'warn';
  } else {
    if (value >= meta.crit) return 'crit';
    if (value >= meta.warn) return 'warn';
  }
  return 'ok';
}
