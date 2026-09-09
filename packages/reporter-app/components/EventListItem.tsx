import { StyleSheet, Text, View } from "react-native";
import type { MatchEvent, MatchEventType } from "@leaguelive/shared";
import { colors, radius, spacing } from "../constants/theme";

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
  event: MatchEvent;
  teamName: (teamId: string) => string;
}

export function EventListItem({ event, teamName }: EventListItemProps) {
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
      </View>
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
});
