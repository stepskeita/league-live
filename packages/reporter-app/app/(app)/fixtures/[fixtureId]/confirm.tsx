import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ApiRequestError, type FixtureContext, type MatchEvent } from "@leaguelive/shared";
import { Button } from "../../../../components/Button";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { EventListItem } from "../../../../components/EventListItem";
import { Screen } from "../../../../components/Screen";
import { colors, radius, spacing } from "../../../../constants/theme";
import { api } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { useEventQueue } from "../../../../lib/event-queue-context";
import { useFixtures } from "../../../../lib/fixtures-context";
import { computeMatchScore, mergeEventsForDisplay } from "../../../../lib/match-session";

export default function ConfirmResultScreen() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { hasPermission } = useAuth();
  const { getById, updateFixture } = useFixtures();
  const { getEntriesForFixture, retry } = useEventQueue();
  const fixture = getById(fixtureId);

  const [context, setContext] = useState<FixtureContext | null>(null);
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const [{ fixtureContext }, { matchEvents }] = await Promise.all([
        api.fixtures.getContext(fixtureId),
        api.matchEvents.list(fixtureId),
      ]);
      setContext(fixtureContext);
      setEvents(matchEvents);
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : "Couldn't load this match.");
    }
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [{ fixtureContext }, { matchEvents }] = await Promise.all([
          api.fixtures.getContext(fixtureId),
          api.matchEvents.list(fixtureId),
        ]);
        if (!cancelled) {
          setContext(fixtureContext);
          setEvents(matchEvents);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiRequestError ? err.message : "Couldn't load this match.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  const handleConfirm = async (): Promise<void> => {
    setConfirmError(null);
    setConfirming(true);
    try {
      const { fixture: updated } = await api.fixtures.confirm(fixtureId);
      updateFixture(updated);
    } catch (err) {
      setConfirmError(err instanceof ApiRequestError ? err.message : "Couldn't confirm this result.");
    } finally {
      setConfirming(false);
    }
  };

  if (!fixture || !context || !events) {
    return (
      <Screen>
        <View style={styles.loading}>
          {loadError ? (
            <>
              <ErrorBanner message={loadError} />
              <Button label="Retry" onPress={() => void load()} />
            </>
          ) : (
            <ActivityIndicator color={colors.primary} size="large" />
          )}
        </View>
      </Screen>
    );
  }

  const queuedForFixture = getEntriesForFixture(fixtureId);
  const displayEvents = mergeEventsForDisplay(events, queuedForFixture);
  const unsyncedCount = displayEvents.filter((event) => event.syncStatus !== "synced").length;

  const locked = fixture.result_locked_at !== null;
  // Once locked, the fixture's own score is the official source of truth —
  // not the locally recomputed one, even though they should always agree.
  const score = locked ? { home: fixture.home_score ?? 0, away: fixture.away_score ?? 0 } : computeMatchScore(displayEvents, context);
  const canConfirm = hasPermission("results.verify");
  const teamName = (teamId: string): string =>
    teamId === context.home_team.id ? context.home_team.name : teamId === context.away_team.id ? context.away_team.name : "—";

  return (
    <Screen scrollable>
      <View style={styles.content}>
        <View style={styles.matchHeader}>
          <Text style={styles.teamName}>{context.home_team.name}</Text>
          <Text style={styles.scoreText}>
            {score.home} – {score.away}
          </Text>
          <Text style={styles.teamName}>{context.away_team.name}</Text>
        </View>

        {locked ? (
          <View style={styles.confirmedBanner}>
            <Text style={styles.confirmedText}>✓ Result confirmed — this is the official score.</Text>
          </View>
        ) : fixture.status !== "completed" ? (
          <ErrorBanner message="This match session hasn't been ended yet." />
        ) : (
          <>
            {unsyncedCount > 0 ? (
              <View style={styles.unsyncedBanner}>
                <Text style={styles.unsyncedText}>
                  ⚠️ {unsyncedCount} event{unsyncedCount === 1 ? " hasn't" : "s haven't"} synced from this device yet. Confirming now
                  will lock a result that doesn&apos;t include{unsyncedCount === 1 ? " it" : " them"}.
                </Text>
              </View>
            ) : null}
            {confirmError ? <ErrorBanner message={confirmError} /> : null}
            {canConfirm ? (
              <Button
                label={confirming ? "Confirming…" : "Confirm Result"}
                onPress={() => void handleConfirm()}
                loading={confirming}
              />
            ) : (
              <View style={styles.waitingBanner}>
                <Text style={styles.waitingText}>
                  Waiting for a verifier to confirm this result. You don&apos;t hold the permission to lock it yourself.
                </Text>
              </View>
            )}
          </>
        )}

        {displayEvents.length > 0 ? (
          <View style={styles.eventList}>
            <Text style={styles.sectionTitle}>Review events</Text>
            {[...displayEvents].reverse().map((event) => (
              <EventListItem
                key={event.client_event_id}
                event={event}
                teamName={teamName}
                onRetry={() => retry(event.client_event_id)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  matchHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  teamName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  confirmedBanner: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  confirmedText: {
    color: "#15803d",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  unsyncedBanner: {
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  unsyncedText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  waitingBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  waitingText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },
  eventList: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
