import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { borderRadius, colors, fontFamily } from '../../theme';

type Variant = 'default' | 'primary' | 'ghost';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  icon?: React.ReactNode;
}

// Web version relied on :hover / :disabled CSS pseudo-classes on a plain
// <button>. Touch devices have no hover, so `pressed` (translateY + border
// color shift) stands in for it, and `disabled` maps to Pressable's disabled
// prop + opacity, matching `button:disabled { opacity: 0.4 }`.
export function Button({ children, onPress, variant = 'default', disabled, loading, style, accessibilityLabel, icon }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        pressed && !disabled && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? colors.black : colors.amber} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, variant === 'primary' && styles.textPrimary]}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel2,
    minHeight: 40,
  },
  pressed: {
    borderColor: colors.amber,
  },
  primary: {
    backgroundColor: colors.amber,
    borderColor: 'transparent',
  },
  primaryPressed: {
    backgroundColor: colors.amberDark,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  textPrimary: {
    color: colors.black,
  },
});
