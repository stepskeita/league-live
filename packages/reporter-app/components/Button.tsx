import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, minTapTarget, radius } from "../constants/theme";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = "primary", loading = false, disabled = false }: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelOutline]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    minHeight: minTapTarget,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  primary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelPrimary: {
    color: colors.white,
  },
  labelOutline: {
    color: colors.primary,
  },
});
