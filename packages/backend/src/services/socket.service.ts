import type { Server as HttpServer } from "node:http";
import { fixtureRoom, REALTIME_CLIENT_EVENTS, REALTIME_SERVER_EVENTS, type LiveMatchState } from "@leaguelive/shared";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { redisClient } from "./redis.service";

let io: SocketIOServer | null = null;

/**
 * FR29/FR30: fan-web and fan-app both subscribe to this over the same
 * Socket.io protocol (packages/shared/src/types/realtime.ts) — nothing here
 * assumes a browser. Public: no auth on the socket itself, matching
 * GET /fixtures/:id/live — live scores are fan-facing, not an org-internal
 * admin surface like the rest of this API.
 *
 * Redis is wired in as the pub/sub *adapter*, not a hand-rolled channel:
 * `io.to(room).emit(...)` already fans out to every server instance via
 * Redis under the hood once the adapter is attached, which is what "publish
 * to a per fixture channel" means in Socket.io terms — a room backed by
 * Redis pub/sub, not a second, parallel messaging system.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  // A subscribed ioredis connection can't run other commands, so pub/sub
  // gets its own dedicated pair, duplicated from the app's existing client
  // (same connection options) rather than a second hardcoded REDIS_URL.
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", (socket) => {
    socket.on(REALTIME_CLIENT_EVENTS.JOIN_FIXTURE, (fixtureId: unknown) => {
      if (typeof fixtureId === "string" && fixtureId.length > 0) {
        socket.join(fixtureRoom(fixtureId));
      }
    });

    socket.on(REALTIME_CLIENT_EVENTS.LEAVE_FIXTURE, (fixtureId: unknown) => {
      if (typeof fixtureId === "string" && fixtureId.length > 0) {
        socket.leave(fixtureRoom(fixtureId));
      }
    });
  });

  return io;
}

export function publishFixtureState(fixtureId: string, state: LiveMatchState): void {
  io?.to(fixtureRoom(fixtureId)).emit(REALTIME_SERVER_EVENTS.FIXTURE_STATE, state);
}

// Whatever a MatchEventDocument's .toJSON() produces — see the matching note
// on live-match-state.service.ts's refreshAndBroadcastLiveMatchState.
export function publishMatchEvent(fixtureId: string, event: Record<string, unknown>): void {
  io?.to(fixtureRoom(fixtureId)).emit(REALTIME_SERVER_EVENTS.MATCH_EVENT, event);
}
