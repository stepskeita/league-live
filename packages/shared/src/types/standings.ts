// FR31 (the standings-computation half — promotion/relegation is the
// separate, admin-triggered LeagueSystem.endSeason flow): the fixed,
// code-defined set of supported tiebreaker criteria. Same reasoning as the
// Permission catalog — a Competition's `ruleset.tiebreakers` (FR15,
// unstructured/caller-defined) can only reference tiebreakers that
// correspond to an actual comparison implemented in code.
export const STANDINGS_TIEBREAKERS = ["points", "goal_difference", "goals_for", "goals_against", "wins"] as const;

export type StandingsTiebreaker = (typeof STANDINGS_TIEBREAKERS)[number];

export interface StandingsPointsRule {
  win: number;
  draw: number;
  loss: number;
}

// The single source of truth for Competition's default ruleset — used both
// as the Mongoose schema default (competition.model.ts) and as the fallback
// standings.service.ts falls back to when a ruleset is missing or
// malformed, so the two can't drift apart.
export const DEFAULT_STANDINGS_POINTS: StandingsPointsRule = { win: 3, draw: 1, loss: 0 };
export const DEFAULT_STANDINGS_TIEBREAKERS: StandingsTiebreaker[] = ["points", "goal_difference", "goals_for"];

// The shape standings.service.ts expects Competition.ruleset to have.
// Ruleset itself stays unstructured/Mixed at the schema level (FR15), so
// this is interpreted defensively at read time, not schema-validated.
export interface StandingsRuleset {
  points?: Partial<StandingsPointsRule>;
  tiebreakers?: string[];
}

// docs/SRS.md section 7's Standing entity, per competition entry.
export interface CompetitionTableRow {
  competition_entry_id: string;
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  rank: number;
}
