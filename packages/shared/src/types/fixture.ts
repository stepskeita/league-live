export const FIXTURE_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

export type FixtureStatus = (typeof FIXTURE_STATUSES)[number];

// FR18/FR19: home_entry_id/away_entry_id reference CompetitionEntry (not
// Team directly) — a fixture is between two entries *in this competition*,
// matching docs/SRS.md section 7's "home entry, away entry".
export interface Fixture {
  id: string;
  organization_id: string;
  competition_id: string;
  home_entry_id: string;
  away_entry_id: string;
  venue_id: string | null;
  datetime: string;
  status: FixtureStatus;
  // FR19: assigned via a dedicated reporter.assign gated action, not the
  // general fixture.manage update.
  reporter_user_id: string | null;
  // FR25: set by the assigned reporter's start/end match session actions.
  started_at: string | null;
  ended_at: string | null;
  // FR28: set only by the results.verify gated post-match confirmation,
  // which computes these by counting "goal" MatchEvents per team. Null
  // (unofficial) until confirmed; once set, the result is locked — see
  // MatchEvent for why events themselves are then rejected.
  home_score: number | null;
  away_score: number | null;
  result_locked_at: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FixtureTeamSummary {
  id: string;
  name: string;
}

// The minimum a match.report/results.verify holder needs to render a
// fixture meaningfully — home_entry_id/away_entry_id resolved to Team
// {id, name} — without needing roster.manage/competition.manage access to
// CompetitionEntry or Team directly. Deliberately just this: no player
// rosters, no venue — see fixture.service.ts's getFixtureContext.
export interface FixtureContext {
  fixture_id: string;
  home_team: FixtureTeamSummary;
  away_team: FixtureTeamSummary;
}

export interface FixtureVenueSummary {
  id: string;
  name: string;
}

// FR33: one row of the public "browse fixtures and results" listing — same
// "resolve ids to names once, server side" reasoning as FixtureContext, just
// for every fan-facing filter dimension at once (country/confederation live
// on the Organization, category/season on the Competition) rather than the
// two team names alone. Deliberately still no player rosters — see
// FixtureContext's comment, same reasoning applies.
export interface PublicFixtureSummary {
  id: string;
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
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
  result_locked_at: string | null;
}
