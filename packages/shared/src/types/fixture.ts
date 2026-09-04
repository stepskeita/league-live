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
  createdAt: string;
  updatedAt: string;
}
