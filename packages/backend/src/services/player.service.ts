import type { PlayerPosition } from "@leaguelive/shared";
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
