import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildCompetitionTable, type TableEntryInput, type TableResultInput } from "./standings.service";

const DEFAULT_RULESET = {
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ["points", "goal_difference", "goals_for"],
};

function entry(id: string, team: string): TableEntryInput {
  return { competition_entry_id: id, team_id: team };
}

function result(home: string, homeScore: number, away: string, awayScore: number): TableResultInput {
  return { home_entry_id: home, away_entry_id: away, home_score: homeScore, away_score: awayScore };
}

function ranksOf(table: ReturnType<typeof buildCompetitionTable>): string[] {
  return table.map((row) => row.competition_entry_id);
}

describe("buildCompetitionTable", () => {
  test("a straightforward league table with a clear points order", () => {
    const entries = [entry("e1", "team-1"), entry("e2", "team-2"), entry("e3", "team-3")];
    const results = [
      result("e1", 2, "e2", 0), // e1 beats e2
      result("e1", 3, "e3", 1), // e1 beats e3
      result("e2", 1, "e3", 0), // e2 beats e3
    ];

    const table = buildCompetitionTable(entries, results, DEFAULT_RULESET);

    assert.deepEqual(ranksOf(table), ["e1", "e2", "e3"]);

    const e1 = table[0]!;
    assert.equal(e1.played, 2);
    assert.equal(e1.won, 2);
    assert.equal(e1.drawn, 0);
    assert.equal(e1.lost, 0);
    assert.equal(e1.goals_for, 5);
    assert.equal(e1.goals_against, 1);
    assert.equal(e1.goal_difference, 4);
    assert.equal(e1.points, 6);
    assert.equal(e1.rank, 1);

    const e2 = table[1]!;
    assert.equal(e2.played, 2);
    assert.equal(e2.won, 1);
    assert.equal(e2.lost, 1);
    assert.equal(e2.goals_for, 1);
    assert.equal(e2.goals_against, 2);
    assert.equal(e2.goal_difference, -1);
    assert.equal(e2.points, 3);
    assert.equal(e2.rank, 2);

    const e3 = table[2]!;
    assert.equal(e3.played, 2);
    assert.equal(e3.won, 0);
    assert.equal(e3.lost, 2);
    assert.equal(e3.goals_for, 1);
    assert.equal(e3.goals_against, 4);
    assert.equal(e3.goal_difference, -3);
    assert.equal(e3.points, 0);
    assert.equal(e3.rank, 3);
  });

  test("a draw awards each side the configured draw points", () => {
    const entries = [entry("e1", "team-1"), entry("e2", "team-2")];
    const results = [result("e1", 1, "e2", 1)];

    const table = buildCompetitionTable(entries, results, DEFAULT_RULESET);

    for (const row of table) {
      assert.equal(row.won, 0);
      assert.equal(row.drawn, 1);
      assert.equal(row.lost, 0);
      assert.equal(row.points, 1);
    }
  });

  test("tiebreaker: equal points are broken by goal difference, per the default ruleset", () => {
    // e1 and e2 each win once (3 points each) against a common opponent,
    // e1 by a much wider margin — goal_difference must rank e1 above e2
    // even though points alone can't separate them.
    const entries = [entry("e1", "team-1"), entry("e2", "team-2"), entry("e3", "team-3")];
    const results = [
      result("e1", 5, "e3", 0), // e1: +3 pts, GD +5
      result("e2", 1, "e3", 0), // e2: +3 pts, GD +1
    ];

    const table = buildCompetitionTable(entries, results, DEFAULT_RULESET);

    assert.deepEqual(ranksOf(table), ["e1", "e2", "e3"]);
    assert.equal(table[0]!.points, 3);
    assert.equal(table[1]!.points, 3);
    assert.equal(table[0]!.goal_difference, 5);
    assert.equal(table[1]!.goal_difference, 1);
  });

  test("tiebreaker: goal difference also equal falls through to goals_for", () => {
    // e1: 3-1 (GD +2), e2: 2-0 (GD +2) — same points, same GD, e1 scored more.
    const entries = [entry("e1", "team-1"), entry("e2", "team-2"), entry("e3", "team-3")];
    const results = [
      result("e1", 3, "e3", 1),
      result("e2", 2, "e3", 0),
    ];

    const table = buildCompetitionTable(entries, results, DEFAULT_RULESET);

    assert.deepEqual(ranksOf(table), ["e1", "e2", "e3"]);
    assert.equal(table[0]!.goal_difference, table[1]!.goal_difference);
    assert.ok(table[0]!.goals_for > table[1]!.goals_for);
  });

  test("an entry with no played games still appears in the table, with all-zero stats", () => {
    const entries = [entry("e1", "team-1"), entry("e2", "team-2"), entry("e3", "team-3")];
    const results = [result("e1", 1, "e2", 0)];

    const table = buildCompetitionTable(entries, results, DEFAULT_RULESET);

    assert.equal(table.length, 3);
    const e3 = table.find((row) => row.competition_entry_id === "e3")!;
    assert.equal(e3.played, 0);
    assert.equal(e3.won, 0);
    assert.equal(e3.points, 0);
    assert.equal(e3.goal_difference, 0);

    // e2 and e3 are both on 0 points, but e2's goal difference is -1 (lost
    // 0-1) while e3's is 0 (unplayed) — e3 correctly outranks e2 on the
    // goal_difference tiebreaker. "Hasn't played" is not the same as
    // "ranks last"; a team with a worse goal difference legitimately can.
    assert.deepEqual(ranksOf(table), ["e1", "e3", "e2"]);
  });

  test("FR15: a custom, non-default points rule is honored, not hardcoded", () => {
    const entries = [entry("e1", "team-1"), entry("e2", "team-2")];
    const results = [result("e1", 2, "e2", 0)];
    const customRuleset = { points: { win: 2, draw: 1, loss: 0 }, tiebreakers: ["points"] };

    const table = buildCompetitionTable(entries, results, customRuleset);

    const winner = table.find((row) => row.competition_entry_id === "e1")!;
    assert.equal(winner.points, 2, "a win should award 2 points under this competition's custom ruleset, not the default 3");
  });

  test("a missing or malformed ruleset falls back to the default points and tiebreakers rather than throwing", () => {
    const entries = [entry("e1", "team-1"), entry("e2", "team-2")];
    const results = [result("e1", 1, "e2", 0)];

    for (const malformed of [null, undefined, "not-an-object", 42, []]) {
      const table = buildCompetitionTable(entries, results, malformed);
      const winner = table.find((row) => row.competition_entry_id === "e1")!;
      assert.equal(winner.points, 3, `expected default win points for ruleset ${JSON.stringify(malformed)}`);
    }
  });

  test("a result referencing an entry outside the table is skipped, not thrown", () => {
    const entries = [entry("e1", "team-1")];
    const results = [result("e1", 2, "unknown-entry", 1)];

    const table = buildCompetitionTable(entries, results, DEFAULT_RULESET);

    assert.equal(table.length, 1);
    assert.equal(table[0]!.played, 0, "a result whose opponent isn't in this table should not be counted");
  });

  test("ties are given fully deterministic order even with no meaningful tiebreaker left", () => {
    const entries = [entry("e2", "team-2"), entry("e1", "team-1")];
    const results: TableResultInput[] = [];

    const table = buildCompetitionTable(entries, results, { points: { win: 3, draw: 1, loss: 0 }, tiebreakers: [] });

    // Every metric is identically zero for both — the final fallback
    // (competition_entry_id) must still produce a stable order.
    assert.deepEqual(ranksOf(table), ["e1", "e2"]);
  });
});
