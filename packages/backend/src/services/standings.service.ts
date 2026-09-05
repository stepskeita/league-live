import {
  DEFAULT_STANDINGS_POINTS,
  DEFAULT_STANDINGS_TIEBREAKERS,
  STANDINGS_TIEBREAKERS,
  type CompetitionTableRow,
  type StandingsRuleset,
  type StandingsTiebreaker,
} from "@leaguelive/shared";
import { Competition } from "../models/competition.model";
import { CompetitionEntry } from "../models/competition-entry.model";
import { Fixture } from "../models/fixture.model";
import { AppError } from "../utils/app-error";

export interface TableEntryInput {
  competition_entry_id: string;
  team_id: string;
}

export interface TableResultInput {
  home_entry_id: string;
  away_entry_id: string;
  home_score: number;
  away_score: number;
}

type RowWithoutRank = Omit<CompetitionTableRow, "rank">;

/**
 * FR31 (standings half — promotion/relegation is the separate,
 * admin-triggered LeagueSystem.endSeason flow, untouched here): the pure
 * computation core, with no I/O, so the sorting/tiebreaker logic is directly
 * unit-testable without a database. `entries` should include every
 * CompetitionEntry in the competition, not just ones with results — an
 * entry with zero played games still belongs in the table (0 points, bottom
 * of the sort). `results` should be confirmed results only; this function
 * doesn't filter, its caller (computeCompetitionTable) does.
 */
export function buildCompetitionTable(
  entries: TableEntryInput[],
  results: TableResultInput[],
  ruleset: unknown,
): CompetitionTableRow[] {
  const statsByEntry = new Map<string, RowWithoutRank>();
  for (const entry of entries) {
    statsByEntry.set(entry.competition_entry_id, {
      competition_entry_id: entry.competition_entry_id,
      team_id: entry.team_id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    });
  }

  const pointsRule = resolvePointsRule(ruleset);

  for (const result of results) {
    const homeStats = statsByEntry.get(result.home_entry_id);
    const awayStats = statsByEntry.get(result.away_entry_id);
    if (!homeStats || !awayStats) {
      // A result referencing an entry outside this table (e.g. removed
      // since) is silently skipped rather than corrupting the table.
      continue;
    }

    homeStats.played += 1;
    awayStats.played += 1;
    homeStats.goals_for += result.home_score;
    homeStats.goals_against += result.away_score;
    awayStats.goals_for += result.away_score;
    awayStats.goals_against += result.home_score;

    if (result.home_score > result.away_score) {
      homeStats.won += 1;
      awayStats.lost += 1;
    } else if (result.away_score > result.home_score) {
      awayStats.won += 1;
      homeStats.lost += 1;
    } else {
      homeStats.drawn += 1;
      awayStats.drawn += 1;
    }
  }

  for (const stats of statsByEntry.values()) {
    stats.goal_difference = stats.goals_for - stats.goals_against;
    stats.points = stats.won * pointsRule.win + stats.drawn * pointsRule.draw + stats.lost * pointsRule.loss;
  }

  const tiebreakers = resolveTiebreakers(ruleset);
  const rows = Array.from(statsByEntry.values()).sort((a, b) => compareRows(a, b, tiebreakers));

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * The imperative shell: fetches a competition's entries and confirmed
 * fixtures from MongoDB and hands them to buildCompetitionTable. Always
 * reads fresh — there's no cache to invalidate — so it's correct
 * "incrementally as each result is confirmed" by construction: call it
 * after fixture N confirms and the table reflects fixture N.
 */
export async function computeCompetitionTable(competitionId: string): Promise<CompetitionTableRow[]> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw new AppError("Competition not found", 404);
  }

  const entries = await CompetitionEntry.find({ competition_id: competition._id });
  const confirmedFixtures = await Fixture.find({
    competition_id: competition._id,
    result_locked_at: { $ne: null },
  });

  return buildCompetitionTable(
    entries.map((entry) => ({
      competition_entry_id: entry._id.toString(),
      team_id: entry.team_id.toString(),
    })),
    confirmedFixtures.map((fixture) => ({
      home_entry_id: fixture.home_entry_id.toString(),
      away_entry_id: fixture.away_entry_id.toString(),
      home_score: fixture.home_score ?? 0,
      away_score: fixture.away_score ?? 0,
    })),
    competition.ruleset,
  );
}

function resolvePointsRule(ruleset: unknown): { win: number; draw: number; loss: number } {
  const points = isPlainObject(ruleset) ? (ruleset as StandingsRuleset).points : undefined;
  return {
    win: typeof points?.win === "number" ? points.win : DEFAULT_STANDINGS_POINTS.win,
    draw: typeof points?.draw === "number" ? points.draw : DEFAULT_STANDINGS_POINTS.draw,
    loss: typeof points?.loss === "number" ? points.loss : DEFAULT_STANDINGS_POINTS.loss,
  };
}

function resolveTiebreakers(ruleset: unknown): StandingsTiebreaker[] {
  const tiebreakers = isPlainObject(ruleset) ? (ruleset as StandingsRuleset).tiebreakers : undefined;
  if (Array.isArray(tiebreakers)) {
    const valid = tiebreakers.filter((tiebreaker): tiebreaker is StandingsTiebreaker =>
      (STANDINGS_TIEBREAKERS as readonly string[]).includes(tiebreaker),
    );
    if (valid.length > 0) {
      return valid;
    }
  }
  return DEFAULT_STANDINGS_TIEBREAKERS;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metricValue(row: RowWithoutRank, metric: StandingsTiebreaker): number {
  switch (metric) {
    case "points":
      return row.points;
    case "goal_difference":
      return row.goal_difference;
    case "goals_for":
      return row.goals_for;
    case "goals_against":
      // Fewer conceded is better — inverted so every metric shares the same
      // "higher sorts first" direction in compareRows.
      return -row.goals_against;
    case "wins":
      return row.won;
  }
}

function compareRows(a: RowWithoutRank, b: RowWithoutRank, tiebreakers: StandingsTiebreaker[]): number {
  for (const metric of tiebreakers) {
    const diff = metricValue(b, metric) - metricValue(a, metric);
    if (diff !== 0) {
      return diff;
    }
  }
  // Deterministic final fallback: a true tie on every configured criterion
  // must still produce stable, repeatable ordering.
  return a.competition_entry_id.localeCompare(b.competition_entry_id);
}
