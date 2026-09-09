import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MatchEventType } from "@leaguelive/shared";
import { colors, radius, spacing } from "../constants/theme";
import type { DisplayEvent } from "../lib/match-session";

export const EVENT_TYPE_LABEL: Record<MatchEventType, string> = {
  goal: "Goal",
  card: "Card",
  substitution: "Substitution",
  half_time: "Half Time",
  full_time: "Full Time",
};

const EVENT_TYPE_ICON: Record<MatchEventType, string> = {
  goal: "⚽",
  card: "🟨",
  substitution: "🔄",
  half_time: "⏸",
  full_time: "🏁",
};

export interface EventListItemProps {
  event: DisplayEvent;
  teamName: (teamId: string) => string;
  /** Only meaningful — and only rendered — when event.syncStatus is "failed". */
  onRetry?: () => void;
}

// Sync status (FR: "surface sync status clearly") is deliberately quiet for
// the happy path — a synced event shows no badge at all — and only speaks
// up for "pending" (still on this device) and "failed" (needs a look),
// with the latter offering a one-tap retry right where the reporter is
// already looking.
export function EventListItem({ event, teamName, onRetry }: EventListItemProps) {
  const icon = event.type === "card" && event.card_color === "red" ? "🟥" : EVENT_TYPE_ICON[event.type];

  return (
    <View style={styles.row}>
      <View style={styles.minuteBadge}>
        <Text style={styles.minuteText}>{event.minute}&apos;</Text>
      </View>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.textContainer}>
        <Text style={styles.type}>{EVENT_TYPE_LABEL[event.type]}</Text>
        <Text style={styles.team}>{teamName(event.team_id)}</Text>
        {event.syncStatus === "failed" && event.errorMessage ? (
          <Text style={styles.errorText}>{event.errorMessage}</Text>
        ) : null}
      </View>
      {event.syncStatus === "pending" ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      ) : null}
      {event.syncStatus === "failed" ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retryBadge}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  minuteBadge: {
    minWidth: 40,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    marginRight: spacing.sm,
  },
  minuteText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  type: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  team: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
  },
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  retryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBackground,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger,
  },
});
