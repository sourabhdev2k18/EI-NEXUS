import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Panel } from '../ui/Panel';
import { dashboardService } from '../../services/dashboardService';
import { borderRadius, colors, fontFamily } from '../../theme';
import type { ToolInfo } from '../../types/dashboard';

export function ToolsPanel() {
  const [tools, setTools] = useState<Record<string, ToolInfo>>({});

  useEffect(() => {
    dashboardService.getTools().then(setTools).catch(console.error);
  }, []);

  return (
    <Panel title="4 MCP Tools" eyebrow="the reasoning trace, live ->">
      <View style={styles.list}>
        {Object.entries(tools).map(([name, tool], index) => (
          <View style={styles.card} key={name}>
            <Text style={styles.num}>TOOL {index + 1}</Text>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.desc}>{tool.description}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.md,
    padding: 12,
  },
  num: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  name: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
});
