import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, minTapTarget, radius, spacing } from "../constants/theme";

export interface MinuteStepperProps {
  value: number;
  onChange: (value: number) => void;
}

// A tap-to-adjust number, not a text field — pre-filled with the match's
// actual elapsed time (see lib/match-session.ts), so the common case is
// "glance and confirm" rather than typing on a small on-screen keyboard.
export function MinuteStepper({ value, onChange }: MinuteStepperProps) {
  const decrement = () => onChange(Math.max(0, value - 1));
  const increment = () => onChange(value + 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Minute</Text>
      <View style={styles.row}>
        <Pressable onPress={decrement} accessibilityRole="button" accessibilityLabel="Decrease minute" style={styles.stepButton}>
          <Text style={styles.stepLabel}>−</Text>
        </Pressable>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{value}&apos;</Text>
        </View>
        <Pressable onPress={increment} accessibilityRole="button" accessibilityLabel="Increase minute" style={styles.stepButton}>
          <Text style={styles.stepLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepButton: {
    width: minTapTarget,
    height: minTapTarget,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 28,
  },
  valueContainer: {
    flex: 1,
    minHeight: minTapTarget,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
});
