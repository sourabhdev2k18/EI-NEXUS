import { SENSOR_META } from '../constants/dashboard';

export type SensorSeverity = 'ok' | 'warn' | 'crit';

export function getSensorSeverity(key: keyof typeof SENSOR_META, value: number): SensorSeverity {
  const meta: any = SENSOR_META[key];
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
