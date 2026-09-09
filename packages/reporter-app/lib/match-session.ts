import type { CardColor, FixtureContext, MatchEvent, MatchEventType } from "@leaguelive/shared";
import type { QueuedMatchEvent, QueueEntryStatus } from "./event-queue";

export interface MatchScore {
  home: number;
  away: number;
}

/**
 * A synced-and-confirmed event, and a still-locally-queued one, rendered
 * identically in the event list — this is what unifies the two. Keyed by
 * client_event_id, which both a MatchEvent and a QueuedMatchEvent carry, so
 * the list has a stable identity across an entry's pending → synced
 * transition rather than swapping keys mid-list.
 */
export interface DisplayEvent {
  client_event_id: string;
  type: MatchEventType;
  minute: number;
  team_id: string;
  card_color: CardColor | null;
  syncStatus: QueueEntryStatus;
  errorMessage: string | null;
}

/**
 * Merges the server's confirmed events with this device's local queue for
 * one fixture into one de-duplicated, displayable list. Once a queued
 * entry's client_event_id shows up in a fresh server fetch, the server's
 * copy wins (it's the confirmed, cross-device truth) — the local queue
 * entry for it is just not shown again, though it stays in storage as
 * "synced" until naturally superseded.
 */
export function mergeEventsForDisplay(serverEvents: MatchEvent[], queueEntries: QueuedMatchEvent[]): DisplayEvent[] {
  const byClientId = new Map<string, DisplayEvent>();

  for (const event of serverEvents) {
    byClientId.set(event.client_event_id, {
      client_event_id: event.client_event_id,
      type: event.type,
      minute: event.minute,
      team_id: event.team_id,
      card_color: event.card_color,
      syncStatus: "synced",
      errorMessage: null,
    });
  }

  for (const entry of queueEntries) {
    if (byClientId.has(entry.client_event_id)) {
      continue;
    }
    byClientId.set(entry.client_event_id, {
      client_event_id: entry.client_event_id,
      type: entry.type,
      minute: entry.minute,
      team_id: entry.team_id,
      card_color: entry.card_color,
      syncStatus: entry.status,
      errorMessage: entry.last_error,
    });
  }

  return Array.from(byClientId.values()).sort((a, b) => a.minute - b.minute);
}

/**
 * Local, instant score display — the same "count goal events per side" the
 * backend does at confirmResult, computed client-side (from the merged
 * pending+synced view) so the reporter sees it update the moment they tap
 * "Goal", not once it's reached the server. A "failed" goal is excluded —
 * it was rejected by the backend, so it isn't part of the match.
 */
export function computeMatchScore(events: DisplayEvent[], context: FixtureContext): MatchScore {
  let home = 0;
  let away = 0;
  for (const event of events) {
    if (event.type !== "goal" || event.syncStatus === "failed") {
      continue;
    }
    if (event.team_id === context.home_team.id) {
      home += 1;
    } else if (event.team_id === context.away_team.id) {
      away += 1;
    }
  }
  return { home, away };
}

/** A sensible default for the minute field: how long the match has actually been running, so logging an event is usually just "confirm this number" rather than "type a number". */
export function computeElapsedMinutes(startedAt: string | null): number {
  if (!startedAt) {
    return 0;
  }
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  return Math.max(0, Math.round(elapsedMs / 60000));
}

/** FR27's idempotency key. Doesn't need cryptographic randomness — just unique enough that one reporter's device never repeats one within a match — so a timestamp plus a short random suffix avoids pulling in a UUID dependency/polyfill. */
export function generateClientEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
