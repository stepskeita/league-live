import type { LiveMatchState } from "./live-match-state";
import type { MatchEvent } from "./match-event";

/**
 * The Socket.io protocol both fan-web and fan-app subscribe to (FR29/FR30).
 * Deliberately just event names and payload shapes — nothing here assumes a
 * browser or any particular client runtime; the Socket.io client SDK works
 * the same way on both.
 */

// Client -> server: join/leave a fixture's room to receive its live updates.
// Payload is just the fixture id (a bare string).
export const REALTIME_CLIENT_EVENTS = {
  JOIN_FIXTURE: "join_fixture",
  LEAVE_FIXTURE: "leave_fixture",
} as const;

// Server -> client, broadcast to everyone in a fixture's room.
export const REALTIME_SERVER_EVENTS = {
  // A single newly logged MatchEvent (goal, card, etc.) — pushed once per
  // event, in addition to the refreshed state below.
  MATCH_EVENT: "match_event",
  // The fixture's full live state, pushed on join and after anything changes
  // it (session start/end, a new event, result confirmation).
  FIXTURE_STATE: "fixture_state",
} as const;

export function fixtureRoom(fixtureId: string): string {
  return `fixture:${fixtureId}`;
}

export interface MatchEventBroadcast {
  fixtureId: string;
  event: MatchEvent;
}

export interface FixtureStateBroadcast {
  fixtureId: string;
  state: LiveMatchState;
}
