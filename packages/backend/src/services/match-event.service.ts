import type { CardColor, MatchEventType } from "@leaguelive/shared";
import { Types } from "mongoose";
import { CompetitionEntry } from "../models/competition-entry.model";
import { MatchEvent, type MatchEventDocument } from "../models/match-event.model";
import { Player } from "../models/player.model";
import { Team } from "../models/team.model";
import { detectMatchEventAnomalies } from "./anomaly-flag.service";
import { recordAuditLogEntry } from "./audit-log.service";
import { getFixture, getFixtureForReporter, resolveFixtureForReporterOrVerifier } from "./fixture.service";
import { getLiveMatchState, refreshAndBroadcastLiveMatchState } from "./live-match-state.service";
import { notifyTeamFollowers } from "./notification.service";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import type { RequestingUser } from "../utils/tenant-scope";

export interface CreateMatchEventInput {
  client_event_id: string;
  type: MatchEventType;
  minute: number;
  team_id: string;
  player_id?: string | null;
  card_color?: CardColor | null;
  details?: Record<string, unknown>;
}

export interface CreateMatchEventResult {
  event: MatchEventDocument;
  // false when this was a retried submission of an already-logged
  // client_event_id — FR27's idempotency, surfaced so the controller can
  // return 200 instead of 201 for a replay.
  created: boolean;
}

/**
 * FR26/FR39: open to two audiences authorized differently — the assigned
 * reporter (match.report) sees only their own fixture's events; a verifier
 * (results.verify) can see any fixture's events within their Organization
 * scope, to review before correcting (FR39) or confirming (FR28). The route
 * gates on requireAnyPermission("match.report", "results.verify"); this is
 * the data-layer check for *which* fixtures that actually grants.
 */
export async function listMatchEvents(requestingUser: RequestingUser, fixtureId: string): Promise<MatchEventDocument[]> {
  const fixture = await resolveFixtureForReporterOrVerifier(requestingUser, fixtureId);
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
      card_color: input.card_color ?? null,
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

  // FR40, best-effort — never allowed to fail this request; see
  // anomaly-flag.service.ts.
  await detectMatchEventAnomalies(fixture, event);

  // FR36, best-effort, goals only (a card/substitution alert isn't
  // interesting enough to page someone's phone for) — notify both sides'
  // followers, not just the scoring team's: someone following the team that
  // just conceded wants to know too.
  if (event.type === "goal") {
    await notifyGoal(homeEntry.team_id.toString(), awayEntry.team_id.toString(), fixture._id.toString());
  }

  return { event, created: true };
}

export interface UpdateMatchEventInput {
  type?: MatchEventType;
  minute?: number;
  team_id?: string;
  player_id?: string | null;
  card_color?: CardColor | null;
  details?: Record<string, unknown>;
}

/**
 * FR39: a verifier reviewing and correcting an event before the result is
 * locked. Deliberately org-scoped (getFixture), not assigned-reporter
 * scoped — the person confirming/correcting a result doesn't have to be the
 * reporter who covered it, same reasoning as confirmResult (FR28).
 */
export async function updateMatchEvent(
  requestingUser: RequestingUser,
  fixtureId: string,
  eventId: string,
  input: UpdateMatchEventInput,
): Promise<MatchEventDocument> {
  const fixture = await getFixture(requestingUser, fixtureId);
  if (fixture.result_locked_at) {
    throw new AppError("Cannot correct events for a fixture whose result is already locked", 409);
  }

  const event = await MatchEvent.findOne({ _id: eventId, fixture_id: fixture._id });
  if (!event) {
    throw new AppError("Match event not found", 404);
  }
  const before = event.toJSON();

  if (input.team_id !== undefined) {
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
    event.team_id = teamId;
  }

  if (input.player_id !== undefined) {
    if (input.player_id === null) {
      event.player_id = null;
    } else {
      const player = await Player.findOne({ _id: input.player_id, organization_id: fixture.organization_id });
      if (!player) {
        throw new AppError("Player not found in this Organization", 400);
      }
      event.player_id = player._id;
    }
  }

  if (input.type !== undefined) {
    event.type = input.type;
  }
  if (input.minute !== undefined) {
    event.minute = input.minute;
  }
  if (input.card_color !== undefined) {
    event.card_color = input.card_color;
  }
  if (input.details !== undefined) {
    event.details = input.details;
  }

  await event.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "update",
    resource_type: "MatchEvent",
    resource_id: event._id,
    before,
    after: event.toJSON(),
  });

  await refreshAndBroadcastLiveMatchState(fixture._id.toString());

  return event;
}

/** FR39: removing an erroneous event before the result is locked. */
export async function deleteMatchEvent(requestingUser: RequestingUser, fixtureId: string, eventId: string): Promise<void> {
  const fixture = await getFixture(requestingUser, fixtureId);
  if (fixture.result_locked_at) {
    throw new AppError("Cannot correct events for a fixture whose result is already locked", 409);
  }

  const event = await MatchEvent.findOne({ _id: eventId, fixture_id: fixture._id });
  if (!event) {
    throw new AppError("Match event not found", 404);
  }
  const before = event.toJSON();

  await event.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "delete",
    resource_type: "MatchEvent",
    resource_id: event._id,
    before,
  });

  await refreshAndBroadcastLiveMatchState(fixture._id.toString());
}

/** FR36: the goal-scored push, sent to both teams' followers with the current live score. */
async function notifyGoal(homeTeamId: string, awayTeamId: string, fixtureId: string): Promise<void> {
  const [homeTeam, awayTeam, state] = await Promise.all([
    Team.findById(homeTeamId),
    Team.findById(awayTeamId),
    getLiveMatchState(fixtureId),
  ]);
  if (!homeTeam || !awayTeam) {
    return;
  }

  const payload = {
    title: "Goal!",
    body: `${homeTeam.name} ${state.home_score}-${state.away_score} ${awayTeam.name}`,
    data: { fixture_id: fixtureId },
  };
  await Promise.all([notifyTeamFollowers(homeTeamId, payload), notifyTeamFollowers(awayTeamId, payload)]);
}
