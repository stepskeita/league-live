import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiRequestError, type CardColor, type MatchEventType } from "@leaguelive/shared";
import { api } from "./api";

// AsyncStorage, not expo-secure-store: SecureStore is backed by the OS
// keychain, which has strict per-item size limits (a few KB) — fine for a
// couple of auth tokens (see token-store.ts), wrong for a queue that grows
// by one entry per goal/card/substitution/half-time/full-time over the
// course of a match. AsyncStorage has no such limit.
const STORAGE_KEY = "leaguelive.eventQueue.v1";

export type QueueEntryStatus = "pending" | "synced" | "failed";

export interface QueuedMatchEvent {
  client_event_id: string;
  fixture_id: string;
  type: MatchEventType;
  minute: number;
  team_id: string;
  player_id: string | null;
  card_color: CardColor | null;
  details: Record<string, unknown>;
  status: QueueEntryStatus;
  queued_at: string;
  last_error: string | null;
}

export interface EnqueueInput {
  client_event_id: string;
  fixture_id: string;
  type: MatchEventType;
  minute: number;
  team_id: string;
  player_id?: string | null;
  card_color?: CardColor | null;
  details?: Record<string, unknown>;
}

type QueueListener = (queue: QueuedMatchEvent[]) => void;
type SyncingListener = (syncing: boolean) => void;

let queue: QueuedMatchEvent[] = [];
let loaded = false;
let loadPromise: Promise<QueuedMatchEvent[]> | null = null;
let syncing = false;

const queueListeners = new Set<QueueListener>();
const syncingListeners = new Set<SyncingListener>();

function notifyQueue(): void {
  for (const listener of queueListeners) {
    listener(queue);
  }
}

function setSyncing(value: boolean): void {
  if (syncing === value) {
    return;
  }
  syncing = value;
  for (const listener of syncingListeners) {
    listener(syncing);
  }
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/** Idempotent — safe to call from multiple mount points; only reads disk once. */
export async function loadQueue(): Promise<QueuedMatchEvent[]> {
  if (loaded) {
    return queue;
  }
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      queue = raw ? (JSON.parse(raw) as QueuedMatchEvent[]) : [];
      loaded = true;
      notifyQueue();
      return queue;
    });
  }
  return loadPromise;
}

export function getQueueSnapshot(): QueuedMatchEvent[] {
  return queue;
}

export function subscribeQueue(listener: QueueListener): () => void {
  queueListeners.add(listener);
  listener(queue);
  return () => queueListeners.delete(listener);
}

export function subscribeSyncing(listener: SyncingListener): () => void {
  syncingListeners.add(listener);
  listener(syncing);
  return () => syncingListeners.delete(listener);
}

/**
 * The offline-first write: persisted to disk before this resolves, and
 * displayed as "pending" from the moment it does — never waits on the
 * network. syncQueue() is triggered afterward but not awaited; the caller
 * (a form submit handler) doesn't sit around for it.
 */
export async function enqueueEvent(input: EnqueueInput): Promise<void> {
  await loadQueue();
  const entry: QueuedMatchEvent = {
    client_event_id: input.client_event_id,
    fixture_id: input.fixture_id,
    type: input.type,
    minute: input.minute,
    team_id: input.team_id,
    player_id: input.player_id ?? null,
    card_color: input.card_color ?? null,
    details: input.details ?? {},
    status: "pending",
    queued_at: new Date().toISOString(),
    last_error: null,
  };
  queue = [...queue, entry];
  await persist();
  notifyQueue();
  void syncQueue();
}

/** A failed (4xx-rejected) entry doesn't get auto-retried — see syncQueue()'s reasoning — so this is how the reporter tries again after fixing whatever was wrong, or just because they want to. */
export async function retryEntry(clientEventId: string): Promise<void> {
  await loadQueue();
  const entry = queue.find((item) => item.client_event_id === clientEventId);
  if (!entry || entry.status === "synced") {
    return;
  }
  entry.status = "pending";
  entry.last_error = null;
  queue = [...queue];
  await persist();
  notifyQueue();
  void syncQueue();
}

/**
 * Walks every "pending" entry in queued order, submitting each with
 * api.matchEvents.create() — idempotent on client_event_id (Prompt 12), so
 * a re-sent entry that actually landed on a previous attempt just comes
 * back as the same event rather than a duplicate.
 *
 * A rejection (4xx — bad data, permission, already-locked fixture) marks
 * that one entry "failed" and moves on to the next; anything else (no
 * network, a 5xx) is treated as "we're offline / the server is down right
 * now" — that entry stays "pending" and the whole pass stops immediately,
 * since every other pending entry would fail the same way for the same
 * reason. A later trigger (reconnect, app foreground, the periodic
 * fallback) resumes from there.
 *
 * Never throws — callers fire this and move on; failures live in queue
 * entry state, not as a rejected promise.
 */
export async function syncQueue(): Promise<void> {
  if (syncing) {
    return;
  }
  setSyncing(true);
  try {
    await loadQueue();
    for (const entry of queue) {
      if (entry.status !== "pending") {
        continue;
      }
      try {
        await api.matchEvents.create(entry.fixture_id, {
          client_event_id: entry.client_event_id,
          type: entry.type,
          minute: entry.minute,
          team_id: entry.team_id,
          player_id: entry.player_id,
          card_color: entry.card_color,
          details: entry.details,
        });
        entry.status = "synced";
        entry.last_error = null;
        queue = [...queue];
        await persist();
        notifyQueue();
      } catch (err) {
        if (err instanceof ApiRequestError && err.status < 500) {
          entry.status = "failed";
          entry.last_error = err.message;
          queue = [...queue];
          await persist();
          notifyQueue();
          continue;
        }
        entry.last_error = err instanceof ApiRequestError ? err.message : "No connection — will retry automatically.";
        queue = [...queue];
        await persist();
        notifyQueue();
        break;
      }
    }
  } finally {
    setSyncing(false);
  }
}

export function getEntriesForFixture(fixtureId: string): QueuedMatchEvent[] {
  return queue.filter((entry) => entry.fixture_id === fixtureId);
}
