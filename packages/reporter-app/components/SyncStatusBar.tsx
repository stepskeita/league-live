import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

export interface SyncStatusBarProps {
  isOnline: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
}

// The ambient half of "surface sync status clearly" — EventListItem covers
// the per-event half. Quiet (renders nothing) once everything's synced and
// online, so it doesn't compete with the tap targets below it on the
// common-case screen.
export function SyncStatusBar({ isOnline, syncing, pendingCount, failedCount }: SyncStatusBarProps) {
  if (!isOnline) {
    return (
      <View style={[styles.bar, styles.offline]}>
        <Text style={styles.text}>
          📴 Offline{pendingCount > 0 ? ` — ${pendingCount} event${pendingCount === 1 ? "" : "s"} will sync automatically` : ""}
        </Text>
      </View>
    );
  }

  if (failedCount > 0) {
    return (
      <View style={[styles.bar, styles.failed]}>
        <Text style={[styles.text, styles.failedText]}>
          ⚠️ {failedCount} event{failedCount === 1 ? "" : "s"} failed to sync — see below
        </Text>
      </View>
    );
  }

  if (syncing || pendingCount > 0) {
    return (
      <View style={[styles.bar, styles.syncing]}>
        <Text style={styles.text}>🔄 Syncing…</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  offline: {
    backgroundColor: colors.surface,
  },
  syncing: {
    backgroundColor: colors.surface,
  },
  failed: {
    backgroundColor: colors.dangerBackground,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  failedText: {
    color: colors.danger,
  },
});
