import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import {
  enqueueEvent,
  getQueueSnapshot,
  loadQueue,
  retryEntry,
  subscribeQueue,
  subscribeSyncing,
  syncQueue,
  type EnqueueInput,
  type QueuedMatchEvent,
} from "./event-queue";

// A fallback for when neither a connectivity change nor an app-foreground
// event fires a retry — NetInfo's reachability check is known to be
// imperfect on some networks (e.g. connected to Wi-Fi with no real
// internet), so this is a safety net, not the primary trigger.
const FALLBACK_SYNC_INTERVAL_MS = 20_000;

export interface EventQueueContextValue {
  isOnline: boolean;
  syncing: boolean;
  queue: QueuedMatchEvent[];
  getEntriesForFixture: (fixtureId: string) => QueuedMatchEvent[];
  enqueue: (input: EnqueueInput) => Promise<void>;
  retry: (clientEventId: string) => void;
}

const EventQueueContext = createContext<EventQueueContextValue | undefined>(undefined);

function isStateOnline(state: NetInfoState): boolean {
  // Both fields are `boolean | null` — null means "unknown", not "offline".
  // Only an explicit false is treated as offline, so an ambiguous read
  // doesn't leave the queue stuck refusing to even try.
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function EventQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedMatchEvent[]>(getQueueSnapshot());
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribeQueue = subscribeQueue(setQueue);
    const unsubscribeSyncing = subscribeSyncing(setSyncing);
    void loadQueue().then(() => void syncQueue());
    return () => {
      unsubscribeQueue();
      unsubscribeSyncing();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isStateOnline(state);
      setIsOnline((wasOnline) => {
        if (!wasOnline && online) {
          void syncQueue();
        }
        return online;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncQueue();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => void syncQueue(), FALLBACK_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const getEntriesForFixture = useCallback(
    (fixtureId: string) => queue.filter((entry) => entry.fixture_id === fixtureId),
    [queue],
  );

  const retry = useCallback((clientEventId: string) => {
    void retryEntry(clientEventId);
  }, []);

  const value = useMemo<EventQueueContextValue>(
    () => ({ isOnline, syncing, queue, getEntriesForFixture, enqueue: enqueueEvent, retry }),
    [isOnline, syncing, queue, getEntriesForFixture, retry],
  );

  return <EventQueueContext.Provider value={value}>{children}</EventQueueContext.Provider>;
}

export function useEventQueue(): EventQueueContextValue {
  const context = useContext(EventQueueContext);
  if (!context) {
    throw new Error("useEventQueue must be used within an EventQueueProvider");
  }
  return context;
}
