import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, fontFamily } from '../../theme';

interface CheckboxProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

// Replaces the `.form-check` pattern (<input type="checkbox"> + <label>).
// RN has no native checkbox input, so this is a Pressable + icon.
export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={12} color={colors.black} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  box: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm - 2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  label: {
    color: colors.muted,
    fontFamily: fontFamily.mono,
    fontSize: 12.5,
  },
});
