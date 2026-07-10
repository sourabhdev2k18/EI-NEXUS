import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { colors, fontFamily } from '../../theme';
import type { TelemetryHistoryPoint } from '../../types/dashboard';

interface TelemetryChartProps {
  history: TelemetryHistoryPoint[];
}

const SERIES = [
  { key: 'temperature', label: 'Temp (C)', color: colors.amber, transform: (p: TelemetryHistoryPoint) => p.temperature },
  { key: 'vibration', label: 'Vibration (mm/s x10)', color: colors.cyan, transform: (p: TelemetryHistoryPoint) => p.vibration * 10 },
  { key: 'voltage', label: 'Voltage (V /2)', color: colors.blue, transform: (p: TelemetryHistoryPoint) => p.voltage / 2 },
  { key: 'current', label: 'Current (A)', color: colors.green, transform: (p: TelemetryHistoryPoint) => p.current },
];

const CHART_HEIGHT = 130;

// Chart.js is web-canvas-only and has no supported React Native build, so
// this is reimplemented from scratch with react-native-svg, plotting the
// same last-60-sample window and the same per-series scaling the original
// applied (vibration*10, voltage/2) so all 4 lines stay readable together.
export function TelemetryChart({ history }: TelemetryChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(screenWidth - 72, 600);

  const { points, min, max } = useMemo(() => {
    const last = history.slice(-60);
    const allValues = last.flatMap((point) => SERIES.map((s) => s.transform(point)));
    const min = allValues.length ? Math.min(...allValues) : 0;
    const max = allValues.length ? Math.max(...allValues) : 1;
    return { points: last, min, max: max === min ? min + 1 : max };
  }, [history]);

  if (!points.length) {
    return (
      <View style={[styles.wrap, { height: CHART_HEIGHT, width: chartWidth }]}>
        <Text style={styles.empty}>Waiting for telemetry...</Text>
      </View>
    );
  }

  const toX = (index: number) => (points.length <= 1 ? 0 : (index / (points.length - 1)) * chartWidth);
  const toY = (value: number) => CHART_HEIGHT - ((value - min) / (max - min)) * CHART_HEIGHT;

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Telemetry chart">
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <Line
            key={fraction}
            x1={0}
            x2={chartWidth}
            y1={CHART_HEIGHT * fraction}
            y2={CHART_HEIGHT * fraction}
            stroke={colors.line}
            strokeWidth={1}
          />
        ))}
        {SERIES.map((series) => (
          <Polyline
            key={series.key}
            points={points.map((point, index) => `${toX(index)},${toY(series.transform(point))}`).join(' ')}
            fill="none"
            stroke={series.color}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View style={styles.legend}>
        {SERIES.map((series) => (
          <View key={series.key} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: series.color }]} />
            <Text style={styles.legendText}>{series.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  empty: {
    color: colors.muted,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    textAlign: 'center',
    paddingTop: 50,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: colors.muted,
  },
});
