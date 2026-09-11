"use client";

import type { LiveMatchState } from "@leaguelive/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { joinFixtureRoom, leaveFixtureRoom, onFixtureState } from "./socket";

/**
 * Prompt 13's realtime channel, generalized to however many fixtures a page
 * wants live updates for at once — the live scores list joins every
 * in-progress fixture's room, a single-fixture view would join just one.
 * Joins/leaves rooms as `fixtureIds` changes and returns the latest
 * LiveMatchState seen for each, keyed by fixture id.
 */
export function useFixtureLiveStates(fixtureIds: string[]): Record<string, LiveMatchState> {
  const [states, setStates] = useState<Record<string, LiveMatchState>>({});
  const joinedRef = useRef<Set<string>>(new Set());
  const idsKey = [...fixtureIds].sort().join(",");

  useEffect(() => {
    const idsSet = new Set(idsKey ? idsKey.split(",") : []);
    for (const id of idsSet) {
      if (!joinedRef.current.has(id)) {
        joinFixtureRoom(id);
        joinedRef.current.add(id);
      }
    }
    for (const id of joinedRef.current) {
      if (!idsSet.has(id)) {
        leaveFixtureRoom(id);
        joinedRef.current.delete(id);
      }
    }
    // idsKey is the intentional dependency — it changes exactly when the
    // *set* of fixture ids changes, unlike a fresh `fixtureIds` array
    // reference on every render with the same contents.
  }, [idsKey]);

  useEffect(() => {
    const joined = joinedRef.current;
    return () => {
      for (const id of joined) {
        leaveFixtureRoom(id);
      }
      joined.clear();
    };
  }, []);

  useEffect(() => {
    return onFixtureState((state) => {
      setStates((prev) => ({ ...prev, [state.fixture_id]: state }));
    });
  }, []);

  // Derived at render time rather than pruned via a second setState call in
  // the join/leave effect above — a fixture that scrolls out of view keeps
  // its last-known state in `states` (harmless), just filtered back out
  // here so a caller never sees state for a fixture it isn't watching.
  return useMemo(() => {
    const result: Record<string, LiveMatchState> = {};
    for (const id of fixtureIds) {
      const state = states[id];
      if (state) {
        result[id] = state;
      }
    }
    return result;
  }, [fixtureIds, states]);
}
