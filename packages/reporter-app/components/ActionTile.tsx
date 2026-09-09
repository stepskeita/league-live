import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

export interface ActionTileProps {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Half time/full time can only happen once each — greys the tile out and swaps the label once it's already logged, rather than letting a mis-tap create a second one. */
  done?: boolean;
}

// A plain emoji rather than an icon library: no new dependency, renders
// natively everywhere, and reads clearly at this size.
export function ActionTile({ icon, label, onPress, disabled = false, done = false }: ActionTileProps) {
  const isDisabled = disabled || done;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [styles.tile, isDisabled ? styles.disabled : null, pressed && !isDisabled ? styles.pressed : null]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      {done ? (
        <View style={styles.doneBadge}>
          <Text style={styles.doneBadgeText}>Logged</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: "48%",
    minHeight: 96,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  doneBadge: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
});
