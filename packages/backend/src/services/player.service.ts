import type { PlayerPosition } from "@leaguelive/shared";
import { Competition } from "../models/competition.model";
import { Fixture } from "../models/fixture.model";
import { MatchEvent } from "../models/match-event.model";
import { Organization } from "../models/organization.model";
import { Player, type PlayerDocument } from "../models/player.model";
import { RosterEntry } from "../models/roster-entry.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { resolveOrganizationScopeForCreate } from "./organization.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface CreatePlayerInput {
  name: string;
  position: PlayerPosition;
  date_of_birth: Date;
  // Only meaningful for a Platform Operator; an org-scoped caller can only
  // ever create a Player in their own Organization.
  organization_id?: string;
}

export interface UpdatePlayerInput {
  name?: string;
  position?: PlayerPosition;
  date_of_birth?: Date;
}

export async function listPlayers(requestingUser: RequestingUser): Promise<PlayerDocument[]> {
  return Player.find(organizationScopeFilter(requestingUser)).sort({ name: 1 });
}

export interface PublicPlayerDetail {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  position: PlayerPosition;
  date_of_birth: string;
}

/** FR35, public — a fan-facing player page's header. */
export async function getPublicPlayer(playerId: string): Promise<PublicPlayerDetail> {
  const player = await Player.findById(playerId);
  if (!player) {
    throw new AppError("Player not found", 404);
  }
  const organization = await Organization.findById(player.organization_id);

  return {
    id: player._id.toString(),
    organization_id: player.organization_id.toString(),
    organization_name: organization?.name ?? "Unknown",
    name: player.name,
    position: player.position,
    date_of_birth: player.date_of_birth.toISOString(),
  };
}

export interface PlayerSeasonStat {
  competition_id: string;
  competition_name: string;
  category: string;
  season: string;
  goals: number;
  yellow_cards: number;
  red_cards: number;
}

/**
 * FR35: "season stats" for a Player — goals and cards, one row per
 * Competition, computed from confirmed fixtures' MatchEvents (the same
 * "derive from confirmed results" approach as standings.service.ts and
 * discipline.service.ts). There is no per-fixture lineup/appearance record
 * anywhere in this system (RosterEntry is team/season membership, not
 * per-match selection), so "appearances played" isn't something this can
 * report — only what's actually derivable: goals scored and cards shown.
 */
export async function getPlayerSeasonStats(playerId: string): Promise<PlayerSeasonStat[]> {
  const events = await MatchEvent.find({ player_id: playerId, type: { $in: ["goal", "card"] } });
  if (events.length === 0) {
    return [];
  }

  const fixtureIds = [...new Set(events.map((event) => event.fixture_id.toString()))];
  const confirmedFixtures = await Fixture.find({ _id: { $in: fixtureIds }, result_locked_at: { $ne: null } });
  const confirmedFixtureById = new Map(confirmedFixtures.map((fixture) => [fixture._id.toString(), fixture]));

  const competitionIds = [...new Set(confirmedFixtures.map((fixture) => fixture.competition_id.toString()))];
  const competitions = await Competition.find({ _id: { $in: competitionIds } });
  const competitionById = new Map(competitions.map((competition) => [competition._id.toString(), competition]));

  const statsByCompetition = new Map<string, PlayerSeasonStat>();
  for (const event of events) {
    const fixture = confirmedFixtureById.get(event.fixture_id.toString());
    if (!fixture) {
      continue;
    }
    const competition = competitionById.get(fixture.competition_id.toString());
    if (!competition) {
      continue;
    }
    const key = competition._id.toString();
    const stat = statsByCompetition.get(key) ?? {
      competition_id: key,
      competition_name: competition.name,
      category: competition.category,
      season: competition.season,
      goals: 0,
      yellow_cards: 0,
      red_cards: 0,
    };
    if (event.type === "goal") {
      stat.goals += 1;
    } else if (event.card_color === "yellow") {
      stat.yellow_cards += 1;
    } else if (event.card_color === "red") {
      stat.red_cards += 1;
    }
    statsByCompetition.set(key, stat);
  }

  return [...statsByCompetition.values()].sort(
    (a, b) => b.season.localeCompare(a.season) || a.competition_name.localeCompare(b.competition_name),
  );
}

export async function getPlayer(requestingUser: RequestingUser, playerId: string): Promise<PlayerDocument> {
  const player = await Player.findOne({ _id: playerId, ...organizationScopeFilter(requestingUser) });
  if (!player) {
    throw new AppError("Player not found", 404);
  }
  return player;
}

export async function createPlayer(
  requestingUser: RequestingUser,
  input: CreatePlayerInput,
): Promise<PlayerDocument> {
  const organizationId = await resolveOrganizationScopeForCreate(requestingUser, input.organization_id);

  const player = await Player.create({
    organization_id: organizationId,
    name: input.name,
    position: input.position,
    date_of_birth: input.date_of_birth,
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "Player",
    resource_id: player._id,
    after: player.toJSON(),
  });

  return player;
}

export async function updatePlayer(
  requestingUser: RequestingUser,
  playerId: string,
  input: UpdatePlayerInput,
): Promise<PlayerDocument> {
  const player = await getPlayer(requestingUser, playerId);
  const before = player.toJSON();

  if (input.name !== undefined) {
    player.name = input.name;
  }
  if (input.position !== undefined) {
    player.position = input.position;
  }
  if (input.date_of_birth !== undefined) {
    player.date_of_birth = input.date_of_birth;
  }

  await player.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: player.organization_id,
    action: "update",
    resource_type: "Player",
    resource_id: player._id,
    before,
    after: player.toJSON(),
  });

  return player;
}

export async function deletePlayer(requestingUser: RequestingUser, playerId: string): Promise<void> {
  const player = await getPlayer(requestingUser, playerId);
  const before = player.toJSON();

  // A player's roster memberships belong to the player record — they don't
  // have independent value once the person record is gone (same cascading
  // pattern as deleteRole -> UserRole).
  await RosterEntry.deleteMany({ player_id: player._id });
  await player.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: player.organization_id,
    action: "delete",
    resource_type: "Player",
    resource_id: player._id,
    before,
  });
}
