import { Player } from "../models/player.model";
import { RosterEntry, type RosterEntryDocument } from "../models/roster-entry.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { getTeam } from "./team.service";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import type { RequestingUser } from "../utils/tenant-scope";

export interface AddToRosterInput {
  player_id: string;
  season: string;
}

/**
 * FR20: a team's player roster per season. `getTeam` (team.service.ts)
 * already enforces the Organization scope — every roster operation here
 * goes through a team fetched that way, so a caller can never manage
 * another Organization's roster by guessing a team id.
 */
export async function listRoster(
  requestingUser: RequestingUser,
  teamId: string,
  season?: string,
): Promise<RosterEntryDocument[]> {
  const team = await getTeam(requestingUser, teamId);
  const filter: Record<string, unknown> = { team_id: team._id };
  if (season) {
    filter.season = season;
  }
  return RosterEntry.find(filter).sort({ season: -1 });
}

export async function addToRoster(
  requestingUser: RequestingUser,
  teamId: string,
  input: AddToRosterInput,
): Promise<RosterEntryDocument> {
  const team = await getTeam(requestingUser, teamId);

  const player = await Player.findOne({ _id: input.player_id, organization_id: team.organization_id });
  if (!player) {
    throw new AppError("Player not found in this Organization", 400);
  }

  const existing = await RosterEntry.findOne({ team_id: team._id, player_id: player._id, season: input.season });
  if (existing) {
    throw new AppError("Player is already on this team's roster for this season", 409);
  }

  let entry: RosterEntryDocument;
  try {
    entry = await RosterEntry.create({
      organization_id: team.organization_id,
      team_id: team._id,
      player_id: player._id,
      season: input.season,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("Player is already on this team's roster for this season", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: team.organization_id,
    action: "create",
    resource_type: "RosterEntry",
    resource_id: entry._id,
    after: entry.toJSON(),
  });

  return entry;
}

export async function removeFromRoster(
  requestingUser: RequestingUser,
  teamId: string,
  entryId: string,
): Promise<void> {
  const team = await getTeam(requestingUser, teamId);

  const entry = await RosterEntry.findOne({ _id: entryId, team_id: team._id });
  if (!entry) {
    throw new AppError("Roster entry not found", 404);
  }
  const before = entry.toJSON();

  await entry.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: team.organization_id,
    action: "delete",
    resource_type: "RosterEntry",
    resource_id: entry._id,
    before,
  });
}
