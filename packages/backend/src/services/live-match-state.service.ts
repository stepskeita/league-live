import type { LiveMatchState } from "@leaguelive/shared";
import { Fixture } from "../models/fixture.model";
import { AppError } from "../utils/app-error";
import { countGoalsByTeam } from "./match-score.service";
import { redisClient } from "./redis.service";
import { publishFixtureState, publishMatchEvent } from "./socket.service";

const KEY_PREFIX = "live_match_state:";
// Generous enough to outlast any single match plus review/confirmation time;
// an active fixture keeps getting refreshed anyway, so this only matters for
// abandoned/orphaned entries.
const TTL_SECONDS = 6 * 60 * 60;

function stateKey(fixtureId: string): string {
  return `${KEY_PREFIX}${fixtureId}`;
}

/**
 * FR30: recomputes a fixture's live state from MongoDB (the source of
 * truth: Fixture + a MatchEvent goal count) and writes the snapshot to
 * Redis (the fast-read cache) — never the other way around. Once a result
 * is locked, the official locked score is used directly rather than
 * recounted, since confirmResult already computed and froze it.
 */
export async function refreshLiveMatchState(fixtureId: string): Promise<LiveMatchState> {
  const fixture = await Fixture.findById(fixtureId);
  if (!fixture) {
    throw new AppError("Fixture not found", 404);
  }

  let homeScore: number;
  let awayScore: number;
  if (fixture.result_locked_at) {
    homeScore = fixture.home_score ?? 0;
    awayScore = fixture.away_score ?? 0;
  } else {
    const goals = await countGoalsByTeam(fixture);
    homeScore = goals.home;
    awayScore = goals.away;
  }

  const state: LiveMatchState = {
    fixture_id: fixture._id.toString(),
    status: fixture.status,
    home_score: homeScore,
    away_score: awayScore,
    started_at: fixture.started_at ? fixture.started_at.toISOString() : null,
    ended_at: fixture.ended_at ? fixture.ended_at.toISOString() : null,
    result_locked_at: fixture.result_locked_at ? fixture.result_locked_at.toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  await redisClient.set(stateKey(fixture._id.toString()), JSON.stringify(state), "EX", TTL_SECONDS);

  return state;
}

/** FR30: the fast-read path — Redis first, falling back to a fresh computation from Mongo if the cache is missing or expired. */
export async function getLiveMatchState(fixtureId: string): Promise<LiveMatchState> {
  const cached = await redisClient.get(stateKey(fixtureId));
  if (cached) {
    return JSON.parse(cached) as LiveMatchState;
  }
  return refreshLiveMatchState(fixtureId);
}

/**
 * Refreshes the cache and pushes the update to connected clients (FR29) —
 * called by fixture.service.ts (session start/end, result confirmation) and
 * match-event.service.ts (a newly logged event) right after their own
 * mutation succeeds.
 *
 * Deliberately best-effort: unlike the audit log, a live-broadcast hiccup
 * (Redis or a socket emit failing) must never fail the underlying request —
 * the MatchEvent or Fixture change already committed to MongoDB, the source
 * of truth, and telling a reporter their goal submission "failed" over a
 * side channel used only for fan-facing live updates would be a worse
 * outcome than a missed live-update push.
 */
export async function refreshAndBroadcastLiveMatchState(
  fixtureId: string,
  // Whatever a MatchEventDocument's .toJSON() produces — typed loosely
  // rather than as the shared MatchEvent wire type, since Mongoose's own
  // toJSON() typing doesn't know about our custom transform's actual shape.
  matchEvent?: Record<string, unknown>,
): Promise<void> {
  try {
    const state = await refreshLiveMatchState(fixtureId);
    publishFixtureState(fixtureId, state);
    if (matchEvent) {
      publishMatchEvent(fixtureId, matchEvent);
    }
  } catch (err) {
    console.error(`Failed to refresh/broadcast live match state for fixture ${fixtureId}:`, err);
  }
}
