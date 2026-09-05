import type { MatchEventType } from "@leaguelive/shared";
import { Types } from "mongoose";
import { CompetitionEntry } from "../models/competition-entry.model";
import { MatchEvent, type MatchEventDocument } from "../models/match-event.model";
import { Player } from "../models/player.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { getFixtureForReporter } from "./fixture.service";
import { refreshAndBroadcastLiveMatchState } from "./live-match-state.service";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import type { RequestingUser } from "../utils/tenant-scope";

export interface CreateMatchEventInput {
  client_event_id: string;
  type: MatchEventType;
  minute: number;
  team_id: string;
  player_id?: string | null;
  details?: Record<string, unknown>;
}

export interface CreateMatchEventResult {
  event: MatchEventDocument;
  // false when this was a retried submission of an already-logged
  // client_event_id — FR27's idempotency, surfaced so the controller can
  // return 200 instead of 201 for a replay.
  created: boolean;
}

export async function listMatchEvents(requestingUser: RequestingUser, fixtureId: string): Promise<MatchEventDocument[]> {
  const fixture = await getFixtureForReporter(requestingUser, fixtureId);
  return MatchEvent.find({ fixture_id: fixture._id }).sort({ minute: 1, createdAt: 1 });
}

/** FR26/FR27: logs a live match event. Idempotent on client_event_id — a queued-and-retried submission returns the original event rather than erroring or duplicating it. */
export async function createMatchEvent(
  requestingUser: RequestingUser,
  fixtureId: string,
  input: CreateMatchEventInput,
): Promise<CreateMatchEventResult> {
  const fixture = await getFixtureForReporter(requestingUser, fixtureId);

  if (fixture.result_locked_at) {
    throw new AppError("Cannot log events for a fixture whose result is already locked", 409);
  }
  if (fixture.status === "scheduled" || fixture.status === "cancelled") {
    throw new AppError(`Cannot log events for a fixture with status "${fixture.status}"`, 400);
  }

  const existing = await MatchEvent.findOne({ fixture_id: fixture._id, client_event_id: input.client_event_id });
  if (existing) {
    return { event: existing, created: false };
  }

  const [homeEntry, awayEntry] = await Promise.all([
    CompetitionEntry.findById(fixture.home_entry_id),
    CompetitionEntry.findById(fixture.away_entry_id),
  ]);
  if (!homeEntry || !awayEntry) {
    throw new AppError("This fixture's competition entries could not be resolved", 400);
  }

  const teamId = new Types.ObjectId(input.team_id);
  if (!teamId.equals(homeEntry.team_id) && !teamId.equals(awayEntry.team_id)) {
    throw new AppError("team_id must be one of this fixture's two teams", 400);
  }

  let playerId: Types.ObjectId | null = null;
  if (input.player_id) {
    const player = await Player.findOne({ _id: input.player_id, organization_id: fixture.organization_id });
    if (!player) {
      throw new AppError("Player not found in this Organization", 400);
    }
    playerId = player._id;
  }

  let event: MatchEventDocument;
  try {
    event = await MatchEvent.create({
      organization_id: fixture.organization_id,
      fixture_id: fixture._id,
      client_event_id: input.client_event_id,
      type: input.type,
      minute: input.minute,
      team_id: teamId,
      player_id: playerId,
      details: input.details ?? {},
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // A concurrent retry of the same client_event_id won the race.
      const raceEvent = await MatchEvent.findOne({ fixture_id: fixture._id, client_event_id: input.client_event_id });
      if (raceEvent) {
        return { event: raceEvent, created: false };
      }
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "create",
    resource_type: "MatchEvent",
    resource_id: event._id,
    after: event.toJSON(),
  });

  // FR29/FR30: only for a genuinely new event — a replayed idempotent
  // submission was already broadcast the first time it was created.
  await refreshAndBroadcastLiveMatchState(fixture._id.toString(), event.toJSON());

  return { event, created: true };
}
