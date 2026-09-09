import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { ApiRequestError, type FixtureContext, type MatchEvent } from "@leaguelive/shared";
import { ActionTile } from "../../../../components/ActionTile";
import { Button } from "../../../../components/Button";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import { EventListItem } from "../../../../components/EventListItem";
import { EventLogModal, type EventLogSubmission, type LoggableEventType } from "../../../../components/EventLogModal";
import { Screen } from "../../../../components/Screen";
import { SyncStatusBar } from "../../../../components/SyncStatusBar";
import { colors, spacing } from "../../../../constants/theme";
import { api } from "../../../../lib/api";
import { useEventQueue } from "../../../../lib/event-queue-context";
import { useFixtures } from "../../../../lib/fixtures-context";
import { computeElapsedMinutes, computeMatchScore, generateClientEventId, mergeEventsForDisplay } from "../../../../lib/match-session";

export default function MatchSessionScreen() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const router = useRouter();
  const { getById, updateFixture } = useFixtures();
  const { isOnline, syncing, getEntriesForFixture, enqueue, retry } = useEventQueue();
  const fixture = getById(fixtureId);

  const [context, setContext] = useState<FixtureContext | null>(null);
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  const [logType, setLogType] = useState<LoggableEventType | null>(null);

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

  const openLogModal = (type: LoggableEventType) => setLogType(type);
  const closeLogModal = () => setLogType(null);

  // Offline-first: every log action writes to the local queue immediately
  // (enqueue() persists to AsyncStorage before it resolves) and returns —
  // it never waits on the network. Whether it actually reaches the backend
  // right away or hours from now, the reporter sees it as "pending"
  // instantly either way; see event-queue.ts for the sync engine.
  const handleModalSubmit = async (input: EventLogSubmission): Promise<void> => {
    if (!logType) {
      return;
    }
    await enqueue({
      client_event_id: generateClientEventId(),
      fixture_id: fixtureId,
      type: logType,
      ...input,
    });
    closeLogModal();
  };

  const handleQuickEvent = (type: "half_time" | "full_time") => {
    if (!context) {
      return;
    }
    const minute = computeElapsedMinutes(fixture?.started_at ?? null);
    const label = type === "half_time" ? "Half Time" : "Full Time";
    Alert.alert(`Log ${label}?`, `This will log ${label} at minute ${minute}'.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log",
        onPress: () => {
          // team_id is required by the schema but meaningless for a
          // whole-match event — defaulting silently to the home team rather
          // than asking the reporter to pick one for no reason.
          void enqueue({
            client_event_id: generateClientEventId(),
            fixture_id: fixtureId,
            type,
            team_id: context.home_team.id,
            minute,
          });
        },
      },
    ]);
  };

  const handleStart = async (): Promise<void> => {
    setActionError(null);
    setStarting(true);
    try {
      const { fixture: updated } = await api.fixtures.start(fixtureId);
      updateFixture(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Couldn't start the match.");
    } finally {
      setStarting(false);
    }
  };

  const handleEnd = async (): Promise<void> => {
    setActionError(null);
    setEnding(true);
    try {
      const { fixture: updated } = await api.fixtures.end(fixtureId);
      updateFixture(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Couldn't end the match.");
    } finally {
      setEnding(false);
    }
  };

  const confirmEnd = () => {
    Alert.alert("End match?", "This stops event logging for this fixture. You can still review before confirming the result.", [
      { text: "Cancel", style: "cancel" },
      { text: "End match", style: "destructive", onPress: () => void handleEnd() },
    ]);
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
  const pendingCount = displayEvents.filter((event) => event.syncStatus === "pending").length;
  const failedCount = displayEvents.filter((event) => event.syncStatus === "failed").length;

  const score = computeMatchScore(displayEvents, context);
  const hasHalfTime = displayEvents.some((event) => event.type === "half_time");
  const hasFullTime = displayEvents.some((event) => event.type === "full_time");
  const teamName = (teamId: string): string =>
    teamId === context.home_team.id ? context.home_team.name : teamId === context.away_team.id ? context.away_team.name : "—";

  return (
    <>
      <Screen scrollable>
        <View style={styles.content}>
          <View style={styles.matchHeader}>
            <Text style={styles.teamName}>{context.home_team.name}</Text>
            {fixture.status === "scheduled" ? (
              <Text style={styles.vs}>vs</Text>
            ) : (
              <Text style={styles.scoreText}>
                {score.home} – {score.away}
              </Text>
            )}
            <Text style={styles.teamName}>{context.away_team.name}</Text>
          </View>

          <SyncStatusBar isOnline={isOnline} syncing={syncing} pendingCount={pendingCount} failedCount={failedCount} />

          {actionError ? <ErrorBanner message={actionError} /> : null}

          {fixture.status === "scheduled" ? (
            <Button label={starting ? "Starting…" : "Start Match"} onPress={() => void handleStart()} loading={starting} />
          ) : null}

          {fixture.status === "cancelled" ? <Text style={styles.cancelledText}>This fixture was cancelled.</Text> : null}

          {fixture.status === "in_progress" ? (
            <>
              <View style={styles.grid}>
                <ActionTile icon="⚽" label="Goal" onPress={() => openLogModal("goal")} />
                <ActionTile icon="🟨" label="Card" onPress={() => openLogModal("card")} />
                <ActionTile icon="🔄" label="Substitution" onPress={() => openLogModal("substitution")} />
                <ActionTile icon="⏸" label="Half Time" onPress={() => handleQuickEvent("half_time")} done={hasHalfTime} />
                <ActionTile icon="🏁" label="Full Time" onPress={() => handleQuickEvent("full_time")} done={hasFullTime} />
              </View>
              <View style={styles.endButton}>
                <Button label={ending ? "Ending…" : "End Match"} variant="outline" onPress={confirmEnd} loading={ending} />
              </View>
            </>
          ) : null}

          {fixture.status === "completed" ? (
            <View style={styles.endButton}>
              <Button label="Go to result confirmation" onPress={() => router.push(`/fixtures/${fixtureId}/confirm`)} />
            </View>
          ) : null}

          {displayEvents.length > 0 ? (
            <View style={styles.eventList}>
              <Text style={styles.sectionTitle}>Events</Text>
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

      <EventLogModal
        key={logType ?? "closed"}
        type={logType}
        homeTeam={context.home_team}
        awayTeam={context.away_team}
        initialMinute={computeElapsedMinutes(fixture.started_at)}
        onCancel={closeLogModal}
        onSubmit={handleModalSubmit}
      />
    </>
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
    // Screen(scrollable) already applies horizontal padding — just top/bottom here.
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
  vs: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    marginVertical: spacing.xs,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  cancelledText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  endButton: {
    marginTop: spacing.lg,
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
