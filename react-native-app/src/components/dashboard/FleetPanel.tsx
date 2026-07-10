import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Panel } from '../ui/Panel';
import { useDashboard } from '../../context/DashboardContext';
import { useInterval } from '../../hooks/useInterval';
import { borderRadius, colors, fontFamily, statusColors } from '../../theme';
import type { Asset } from '../../types/dashboard';

interface FleetCardProps {
  asset: Asset;
  selected: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  cardWidth: string;
}

function FleetCard({ asset, selected, busy, onSelect, cardWidth }: FleetCardProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!busy) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  const palette = statusColors[asset.status] ?? statusColors.NOMINAL;

  return (
    <Pressable
      onPress={() => onSelect(asset.asset_id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.card, { width: cardWidth as any }, selected && styles.cardSelected]}
    >
      {busy ? <Animated.View style={[styles.busyDot, { opacity: pulse }]} /> : null}
      <Text style={styles.id}>{asset.asset_id}</Text>
      <Text style={styles.site}>{asset.site}</Text>
      <View style={[styles.statusBadge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.statusText, { color: palette.fg }]}>{asset.status}</Text>
      </View>
    </Pressable>
  );
}

const MemoFleetCard = memo(FleetCard);

export function FleetPanel() {
  const { fleet, busyAssets, selectedAssetId, setSelectedAssetId, refreshFleet } = useDashboard();
  const { width } = useWindowDimensions();
  // Web: 4 cols by default, 2 cols under 700px. We mirror that with percentage widths.
  const columns = width < 500 ? 2 : 4;
  const gap = 10;
  const cardWidth = `${100 / columns}%`;

  useEffect(() => {
    refreshFleet().catch(console.error);
  }, [refreshFleet]);
  useInterval(() => refreshFleet().catch(console.error), 2000);

  return (
    <Panel title="Fleet Overview - GOH-UC-065 Agentic Asset Management" eyebrow={`${fleet.length || 4} assets, monitored & acted on concurrently`}>
      <View style={[styles.grid, { marginHorizontal: -gap / 2 }]}>
        {fleet.map((asset) => (
          <View key={asset.asset_id} style={{ paddingHorizontal: gap / 2, marginBottom: gap, width: cardWidth as any }}>
            <MemoFleetCard
              asset={asset}
              selected={asset.asset_id === selectedAssetId}
              busy={busyAssets.includes(asset.asset_id)}
              onSelect={setSelectedAssetId}
              cardWidth="100%"
            />
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    position: 'relative',
  },
  cardSelected: {
    borderColor: colors.amber,
    backgroundColor: 'rgba(255,138,61,0.06)',
  },
  id: {
    fontFamily: fontFamily.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.text,
  },
  site: {
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.sm - 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  busyDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.cyan,
  },
});
