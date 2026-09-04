import { Club, type ClubDocument } from "../models/club.model";
import { Team } from "../models/team.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { resolveOrganizationScopeForCreate } from "./organization.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface CreateClubInput {
  name: string;
  // Only meaningful for a Platform Operator; an org-scoped caller can only
  // ever create a Club in their own Organization.
  organization_id?: string;
}

export interface UpdateClubInput {
  name?: string;
}

export async function listClubs(requestingUser: RequestingUser): Promise<ClubDocument[]> {
  return Club.find(organizationScopeFilter(requestingUser)).sort({ name: 1 });
}

export async function getClub(requestingUser: RequestingUser, clubId: string): Promise<ClubDocument> {
  const club = await Club.findOne({ _id: clubId, ...organizationScopeFilter(requestingUser) });
  if (!club) {
    throw new AppError("Club not found", 404);
  }
  return club;
}

export async function createClub(requestingUser: RequestingUser, input: CreateClubInput): Promise<ClubDocument> {
  const organizationId = await resolveOrganizationScopeForCreate(requestingUser, input.organization_id);

  const club = await Club.create({ organization_id: organizationId, name: input.name });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "Club",
    resource_id: club._id,
    after: club.toJSON(),
  });

  return club;
}

export async function updateClub(
  requestingUser: RequestingUser,
  clubId: string,
  input: UpdateClubInput,
): Promise<ClubDocument> {
  const club = await getClub(requestingUser, clubId);
  const before = club.toJSON();

  if (input.name !== undefined) {
    club.name = input.name;
  }

  await club.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: club.organization_id,
    action: "update",
    resource_type: "Club",
    resource_id: club._id,
    before,
    after: club.toJSON(),
  });

  return club;
}

export async function deleteClub(requestingUser: RequestingUser, clubId: string): Promise<void> {
  const club = await getClub(requestingUser, clubId);

  const hasTeams = await Team.exists({ club_id: club._id });
  if (hasTeams) {
    throw new AppError("Cannot delete a Club that still has Teams", 409);
  }

  const before = club.toJSON();
  await club.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: club.organization_id,
    action: "delete",
    resource_type: "Club",
    resource_id: club._id,
    before,
  });
}
