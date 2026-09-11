"use client";

import { REALTIME_CLIENT_EVENTS, REALTIME_SERVER_EVENTS, type LiveMatchState, type MatchEvent } from "@leaguelive/shared";
import { io, type Socket } from "socket.io-client";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/**
 * One shared connection for the whole app (Prompt 13's Socket.io channel,
 * packages/shared/src/types/realtime.ts) — every page that wants live
 * updates joins/leaves fixture rooms on this same socket rather than
 * opening its own. Lazily created on first use, since this must never run
 * during server rendering (there is no socket on the server for this
 * public, browser-only realtime channel).
 */
function getSocket(): Socket {
  socket ??= io(baseUrl, { transports: ["websocket", "polling"] });
  return socket;
}

export function joinFixtureRoom(fixtureId: string): void {
  getSocket().emit(REALTIME_CLIENT_EVENTS.JOIN_FIXTURE, fixtureId);
}

export function leaveFixtureRoom(fixtureId: string): void {
  getSocket().emit(REALTIME_CLIENT_EVENTS.LEAVE_FIXTURE, fixtureId);
}

// The server broadcasts the bare state/event objects to a fixture's room
// (see backend/src/services/socket.service.ts), not wrapped in
// FixtureStateBroadcast/MatchEventBroadcast — both LiveMatchState and
// MatchEvent already carry their own fixture_id, which is how one shared
// listener (registered once, not per fixture room) knows which fixture a
// given update belongs to.
export function onFixtureState(handler: (state: LiveMatchState) => void): () => void {
  getSocket().on(REALTIME_SERVER_EVENTS.FIXTURE_STATE, handler);
  return () => {
    socket?.off(REALTIME_SERVER_EVENTS.FIXTURE_STATE, handler);
  };
}

export function onMatchEvent(handler: (event: MatchEvent) => void): () => void {
  getSocket().on(REALTIME_SERVER_EVENTS.MATCH_EVENT, handler);
  return () => {
    socket?.off(REALTIME_SERVER_EVENTS.MATCH_EVENT, handler);
  };
}
