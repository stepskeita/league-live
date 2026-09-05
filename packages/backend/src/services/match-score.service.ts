import { CompetitionEntry } from "../models/competition-entry.model";
import type { FixtureDocument } from "../models/fixture.model";
import { MatchEvent } from "../models/match-event.model";
import { AppError } from "../utils/app-error";

/**
 * Counts "goal" MatchEvents per side for a fixture — used by
 * fixture.service.ts's confirmResult (the official, locked score) and
 * live-match-state.service.ts's refresh (the live, unofficial score while a
 * match is still in progress). Pulled out to its own module, rather than
 * living in fixture.service.ts, purely to avoid a circular import: fixture
 * service needs to call into live-match-state.service.ts to broadcast after
 * a mutation, and live-match-state.service.ts needs this counting logic —
 * neither can depend on the other.
 */
export async function countGoalsByTeam(fixture: FixtureDocument): Promise<{ home: number; away: number }> {
  const [homeEntry, awayEntry] = await Promise.all([
    CompetitionEntry.findById(fixture.home_entry_id),
    CompetitionEntry.findById(fixture.away_entry_id),
  ]);
  if (!homeEntry || !awayEntry) {
    throw new AppError("This fixture's competition entries could not be resolved", 400);
  }

  const [home, away] = await Promise.all([
    MatchEvent.countDocuments({ fixture_id: fixture._id, type: "goal", team_id: homeEntry.team_id }),
    MatchEvent.countDocuments({ fixture_id: fixture._id, type: "goal", team_id: awayEntry.team_id }),
  ]);

  return { home, away };
}
