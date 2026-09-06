import { StyleSheet, Text, View } from "react-native";
import type { Fixture, FixtureStatus } from "@leaguelive/shared";
import { colors, radius, spacing } from "../constants/theme";

const STATUS_LABEL: Record<FixtureStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<FixtureStatus, string> = {
  scheduled: colors.textSecondary,
  in_progress: colors.primary,
  completed: colors.textMuted,
  cancelled: colors.danger,
};

function formatDateTime(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  return {
    date: parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
    time: parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

// The backend's own read scope for a Reporter (GET /fixtures/mine) returns
// ids, not resolved team/competition names — there's no endpoint a plain
// match.report holder can call to look those up yet. So this card shows
// what's actually available (when, and current status) rather than
// fabricating a "Team A vs Team B" line this data can't back up.
export function FixtureCard({ fixture }: { fixture: Fixture }) {
  const { date, time } = formatDateTime(fixture.datetime);
  const statusColor = STATUS_COLOR[fixture.status];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.date}>{date}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${statusColor}1a` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_LABEL[fixture.status]}</Text>
        </View>
      </View>
      {fixture.status === "completed" && fixture.home_score !== null && fixture.away_score !== null ? (
        <Text style={styles.score}>
          {fixture.home_score} – {fixture.away_score}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 72,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  date: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  time: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  score: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
});
