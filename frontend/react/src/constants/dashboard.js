export const SENSOR_META = {
  temperature: { label: 'Temperature', unit: 'C', warn: 75, crit: 95 },
  vibration: { label: 'Vibration', unit: 'mm/s', warn: 3.0, crit: 5.0 },
  load: { label: 'Load', unit: '%', warn: 90, crit: 98 },
  voltage: { label: 'Voltage', unit: 'V', warn: 220, crit: 200, inverse: true },
  current: { label: 'Current', unit: 'A', warn: 38, crit: 44 },
  fan_speed: { label: 'Fan Speed', unit: '%', warn: 999, crit: 999 }
};

export const FAILURE_MODES = [
  { value: 'OVERTEMP', label: 'Overtemperature' },
  { value: 'VIBRATION', label: 'Excess Vibration' },
  { value: 'VOLTAGE', label: 'Voltage Sag' },
  { value: 'CURRENT', label: 'Current Imbalance' }
];

export const USE_CASES = [
  { label: 'GOH-UC-034 - AI Agent for RCA & Process Optimization', primary: true },
  { label: 'GOH-UC-010 - Predictive Maintenance' },
  { label: 'GOH-UC-046 - Fault Detection' },
  { label: 'GOH-UC-065 - Agentic Asset Management' }
];

export const FLOW_STATES = [
  ['MONITORING', 'MONITOR'],
  ['DETECTED', 'DETECT'],
  ['DIAGNOSING', 'DIAGNOSE'],
  ['FIXING', 'FIX'],
  ['VALIDATING', 'VALIDATE'],
  ['OPTIMIZING', 'OPTIMIZE']
];

export const CHAT_SUGGESTIONS = ['what happened?', 'fleet status?', 'why did it fail?', 'how many incidents?'];
