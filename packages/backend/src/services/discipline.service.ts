import type { DisciplinaryRecordRow } from "@leaguelive/shared";
import { Fixture } from "../models/fixture.model";
import { MatchEvent } from "../models/match-event.model";
import { getCompetition } from "./competition.service";
import type { RequestingUser } from "../utils/tenant-scope";

/**
 * FR41: disciplinary records, per player, for one Competition (which itself
 * spans exactly one season — see docs/SRS.md section 7 — so there's no
 * separate season dimension to filter by). Computed from confirmed
 * fixtures' "card" MatchEvents, the same "derive from confirmed results"
 * approach as standings.service.ts, rather than a separately maintained
 * ledger.
 */
export async function computeDisciplinaryRecords(
  requestingUser: RequestingUser,
  competitionId: string,
): Promise<DisciplinaryRecordRow[]> {
  // Scoped fetch: a results.verify holder can only see discipline for a
  // competition they have access to, same as every other org-scoped read.
  const competition = await getCompetition(requestingUser, competitionId);

  const confirmedFixtureIds = await Fixture.find({
    competition_id: competition._id,
    result_locked_at: { $ne: null },
  }).distinct("_id");

  const cardEvents = await MatchEvent.find({
    fixture_id: { $in: confirmedFixtureIds },
    type: "card",
    player_id: { $ne: null },
  });

  const byPlayer = new Map<string, DisciplinaryRecordRow>();
  for (const event of cardEvents) {
    if (!event.player_id) {
      continue;
    }
    const key = event.player_id.toString();
    const row = byPlayer.get(key) ?? { player_id: key, yellow_cards: 0, red_cards: 0 };
    if (event.card_color === "yellow") {
      row.yellow_cards += 1;
    } else if (event.card_color === "red") {
      row.red_cards += 1;
    }
    byPlayer.set(key, row);
  }

  return Array.from(byPlayer.values()).sort(
    (a, b) => b.red_cards - a.red_cards || b.yellow_cards - a.yellow_cards || a.player_id.localeCompare(b.player_id),
  );
}

export async function getPlayerDisciplinaryRecord(
  requestingUser: RequestingUser,
  competitionId: string,
  playerId: string,
): Promise<DisciplinaryRecordRow> {
  const records = await computeDisciplinaryRecords(requestingUser, competitionId);
  return records.find((row) => row.player_id === playerId) ?? { player_id: playerId, yellow_cards: 0, red_cards: 0 };
}
