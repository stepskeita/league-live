import type { CompetitionFormatConfig } from "@leaguelive/shared";
import { Types } from "mongoose";
import { Competition, type CompetitionDocument } from "../models/competition.model";
import { CompetitionEntry } from "../models/competition-entry.model";
import { Fixture } from "../models/fixture.model";
import { Organization } from "../models/organization.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { resolveOrganizationScopeForCreate } from "./organization.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface CreateCompetitionInput {
  name: string;
  category: string;
  format: CompetitionFormatConfig;
  ruleset?: Record<string, unknown>;
  season: string;
  // Only meaningful for a Platform Operator; an org-scoped caller can only
  // ever create a Competition in their own Organization.
  organization_id?: string;
}

export interface UpdateCompetitionInput {
  name?: string;
  category?: string;
  format?: CompetitionFormatConfig;
  ruleset?: Record<string, unknown>;
  season?: string;
}

export async function listCompetitions(requestingUser: RequestingUser): Promise<CompetitionDocument[]> {
  return Competition.find(organizationScopeFilter(requestingUser)).sort({ season: -1, name: 1 });
}

export interface ListPublicCompetitionsInput {
  organization_id?: string;
  category?: string;
}

/**
 * FR33/FR34: the fan-facing "browse by competition / category" filter and a
 * competition picker — every Competition on the platform, not scoped to a
 * caller's own Organization like listCompetitions above (there is no
 * "caller" here at all, this is public).
 */
export async function listPublicCompetitions(input: ListPublicCompetitionsInput): Promise<CompetitionDocument[]> {
  const filter: Record<string, unknown> = {};
  if (input.organization_id) {
    filter.organization_id = new Types.ObjectId(input.organization_id);
  }
  if (input.category) {
    filter.category = input.category;
  }
  return Competition.find(filter).sort({ season: -1, name: 1 });
}

export interface PublicCompetitionDetail {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  category: string;
  season: string;
  format: CompetitionFormatConfig;
}

/** FR34/FR35, public — a fan-facing competition (table/bracket) page's header. */
export async function getPublicCompetition(competitionId: string): Promise<PublicCompetitionDetail> {
  const competition = await Competition.findById(competitionId);
  if (!competition) {
    throw new AppError("Competition not found", 404);
  }
  const organization = await Organization.findById(competition.organization_id);

  return {
    id: competition._id.toString(),
    organization_id: competition.organization_id.toString(),
    organization_name: organization?.name ?? "Unknown",
    name: competition.name,
    category: competition.category,
    season: competition.season,
    format: competition.format,
  };
}

/** FR18: "any competition they have access to" — this scoped fetch is what that means in practice. */
export async function getCompetition(requestingUser: RequestingUser, competitionId: string): Promise<CompetitionDocument> {
  const competition = await Competition.findOne({ _id: competitionId, ...organizationScopeFilter(requestingUser) });
  if (!competition) {
    throw new AppError("Competition not found", 404);
  }
  return competition;
}

export async function createCompetition(
  requestingUser: RequestingUser,
  input: CreateCompetitionInput,
): Promise<CompetitionDocument> {
  const organizationId = await resolveOrganizationScopeForCreate(requestingUser, input.organization_id);

  const competition = await Competition.create({
    organization_id: organizationId,
    name: input.name,
    category: input.category,
    format: input.format,
    season: input.season,
    ...(input.ruleset !== undefined ? { ruleset: input.ruleset } : {}),
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "Competition",
    resource_id: competition._id,
    after: competition.toJSON(),
  });

  return competition;
}

export async function updateCompetition(
  requestingUser: RequestingUser,
  competitionId: string,
  input: UpdateCompetitionInput,
): Promise<CompetitionDocument> {
  const competition = await getCompetition(requestingUser, competitionId);
  const before = competition.toJSON();

  if (input.name !== undefined) {
    competition.name = input.name;
  }
  if (input.category !== undefined) {
    competition.category = input.category;
  }
  if (input.format !== undefined) {
    competition.format = input.format;
  }
  if (input.ruleset !== undefined) {
    competition.ruleset = input.ruleset;
  }
  if (input.season !== undefined) {
    competition.season = input.season;
  }

  await competition.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: competition.organization_id,
    action: "update",
    resource_type: "Competition",
    resource_id: competition._id,
    before,
    after: competition.toJSON(),
  });

  return competition;
}

export async function deleteCompetition(requestingUser: RequestingUser, competitionId: string): Promise<void> {
  const competition = await getCompetition(requestingUser, competitionId);
  const before = competition.toJSON();

  // A competition's entries and fixtures don't have independent value once
  // the competition itself is gone — same cascading pattern as
  // deleteRole -> UserRole.
  await Fixture.deleteMany({ competition_id: competition._id });
  await CompetitionEntry.deleteMany({ competition_id: competition._id });
  await competition.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: competition.organization_id,
    action: "delete",
    resource_type: "Competition",
    resource_id: competition._id,
    before,
  });
}
