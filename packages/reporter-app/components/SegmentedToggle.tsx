import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, minTapTarget, radius, spacing } from "../constants/theme";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** e.g. yellow/red for card color — falls back to the primary accent when omitted (team selection). */
  color?: string;
}

export interface SegmentedToggleProps<T extends string> {
  label: string;
  options: [SegmentedOption<T>, SegmentedOption<T>];
  value: T | null;
  onChange: (value: T) => void;
}

// Two big side-by-side tap targets sharing one selection — used for both
// "which team" and "which card color", since both are the same interaction.
export function SegmentedToggle<T extends string>({ label, options, value, onChange }: SegmentedToggleProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          const accent = option.color ?? colors.primary;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.option,
                { borderColor: selected ? accent : colors.border },
                selected ? { backgroundColor: `${accent}1a` } : null,
              ]}
            >
              <Text style={[styles.optionLabel, selected ? { color: accent } : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
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
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: minTapTarget,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
});
