import type { FixtureStatus, FixtureTeamSummary, FixtureVenueSummary } from "./fixture";

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

// FR32: one row of the public "browse every in-progress fixture" listing —
// resolved names (same reasoning as PublicFixtureSummary in fixture.ts —
// organization/competition/team ids alone aren't renderable by a fan-facing
// client with no other access) merged with the fixture's live score. Not
// the full Fixture record — notably no reporter_user_id, which is an
// internal operational detail, not fan facing.
export interface LiveFixtureSummary {
  fixture_id: string;
  organization_id: string;
  organization_name: string;
  competition_id: string;
  competition_name: string;
  category: string;
  season: string;
  home_team: FixtureTeamSummary;
  away_team: FixtureTeamSummary;
  venue: FixtureVenueSummary | null;
  datetime: string;
  liveMatchState: LiveMatchState;
}
