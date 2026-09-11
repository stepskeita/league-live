import { Types } from "mongoose";
import { CompetitionEntry } from "../models/competition-entry.model";
import { Club } from "../models/club.model";
import { RosterEntry } from "../models/roster-entry.model";
import { Team, type TeamDocument } from "../models/team.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { resolveOrganizationScopeForCreate } from "./organization.service";
import { resolveVenueInOrganization } from "./venue.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface CreateTeamInput {
  name: string;
  club_id: string;
  category: string;
  venue_id?: string | null;
  // Only meaningful for a Platform Operator; an org-scoped caller can only
  // ever create a Team in their own Organization.
  organization_id?: string;
}

export interface UpdateTeamInput {
  name?: string;
  category?: string;
  club_id?: string;
  venue_id?: string | null;
}

export async function listTeams(requestingUser: RequestingUser): Promise<TeamDocument[]> {
  return Team.find(organizationScopeFilter(requestingUser)).sort({ name: 1 });
}

export interface ListPublicTeamsInput {
  organization_id?: string;
  category?: string;
}

/** FR33: the fan-facing "browse by team" filter — every Team on the platform, not scoped to a caller's own Organization. */
export async function listPublicTeams(input: ListPublicTeamsInput): Promise<TeamDocument[]> {
  const filter: Record<string, unknown> = {};
  if (input.organization_id) {
    filter.organization_id = new Types.ObjectId(input.organization_id);
  }
  if (input.category) {
    filter.category = input.category;
  }
  return Team.find(filter).sort({ name: 1 });
}

export async function getTeam(requestingUser: RequestingUser, teamId: string): Promise<TeamDocument> {
  const team = await Team.findOne({ _id: teamId, ...organizationScopeFilter(requestingUser) });
  if (!team) {
    throw new AppError("Team not found", 404);
  }
  return team;
}

export async function createTeam(requestingUser: RequestingUser, input: CreateTeamInput): Promise<TeamDocument> {
  const organizationId = await resolveOrganizationScopeForCreate(requestingUser, input.organization_id);

  const club = await Club.findOne({ _id: input.club_id, organization_id: organizationId });
  if (!club) {
    throw new AppError("Club not found in this Organization", 400);
  }

  const venueId = await resolveVenueInOrganization(organizationId, input.venue_id);

  const team = await Team.create({
    organization_id: organizationId,
    club_id: club._id,
    name: input.name,
    category: input.category,
    venue_id: venueId,
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "Team",
    resource_id: team._id,
    after: team.toJSON(),
  });

  return team;
}

export async function updateTeam(
  requestingUser: RequestingUser,
  teamId: string,
  input: UpdateTeamInput,
): Promise<TeamDocument> {
  const team = await getTeam(requestingUser, teamId);
  const before = team.toJSON();

  if (input.name !== undefined) {
    team.name = input.name;
  }
  if (input.category !== undefined) {
    team.category = input.category;
  }
  if (input.club_id !== undefined) {
    const club = await Club.findOne({ _id: input.club_id, organization_id: team.organization_id });
    if (!club) {
      throw new AppError("Club not found in this Organization", 400);
    }
    team.club_id = club._id;
  }
  if (input.venue_id !== undefined) {
    team.venue_id = await resolveVenueInOrganization(team.organization_id, input.venue_id);
  }

  await team.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: team.organization_id,
    action: "update",
    resource_type: "Team",
    resource_id: team._id,
    before,
    after: team.toJSON(),
  });

  return team;
}

export async function deleteTeam(requestingUser: RequestingUser, teamId: string): Promise<void> {
  const team = await getTeam(requestingUser, teamId);
  const before = team.toJSON();

  // Unlike roster entries, a Team's competition entries have independent
  // value (fixtures, a competition's own bracket/table) that shouldn't
  // silently disappear because the Team record did — same "block, don't
  // cascade" rule as deleteClub/deleteVenue when a Team references them.
  const hasCompetitionEntries = await CompetitionEntry.exists({ team_id: team._id });
  if (hasCompetitionEntries) {
    throw new AppError("Cannot delete a Team that is still entered in a Competition", 409);
  }

  // A team's roster entries belong to the team — same cascading pattern as
  // deleteRole -> UserRole and deletePlayer -> RosterEntry.
  await RosterEntry.deleteMany({ team_id: team._id });
  await team.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: team.organization_id,
    action: "delete",
    resource_type: "Team",
    resource_id: team._id,
    before,
  });
}
