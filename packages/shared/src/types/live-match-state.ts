import type { FixtureStatus } from "./fixture";

// FR30: the live match state maintained per fixture — a fast-read snapshot
// cached in Redis, always rebuildable from MongoDB (Fixture + MatchEvent),
// which stays the source of truth. Deliberately a small, flat shape: this is
// what's pushed to fans in real time (FR29), not the full Fixture record.
export interface LiveMatchState {
  fixture_id: string;
  status: FixtureStatus;
  home_score: number;
  away_score: number;
  started_at: string | null;
  ended_at: string | null;
  result_locked_at: string | null;
  updated_at: string;
}
