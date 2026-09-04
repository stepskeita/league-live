import type { FixtureStatus } from "@leaguelive/shared";
import { Types } from "mongoose";
import { CompetitionEntry, type CompetitionEntryDocument } from "../models/competition-entry.model";
import type { CompetitionDocument } from "../models/competition.model";
import { Fixture, type FixtureDocument } from "../models/fixture.model";
import { User } from "../models/user.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { getCompetition } from "./competition.service";
import { resolveVenueInOrganization } from "./venue.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface CreateFixtureInput {
  competition_id: string;
  home_entry_id: string;
  away_entry_id: string;
  venue_id?: string | null;
  datetime: Date;
  status?: FixtureStatus;
}

export interface UpdateFixtureInput {
  home_entry_id?: string;
  away_entry_id?: string;
  venue_id?: string | null;
  datetime?: Date;
  status?: FixtureStatus;
}

export interface ListFixturesInput {
  competition_id?: string;
}

export async function listFixtures(
  requestingUser: RequestingUser,
  input: ListFixturesInput,
): Promise<FixtureDocument[]> {
  const filter: Record<string, unknown> = { ...organizationScopeFilter(requestingUser) };
  if (input.competition_id) {
    filter.competition_id = new Types.ObjectId(input.competition_id);
  }
  return Fixture.find(filter).sort({ datetime: 1 });
}

/** FR24: a Reporter sees only fixtures assigned to them — no permission gate beyond being authenticated. */
export async function listMyAssignedFixtures(requestingUser: RequestingUser): Promise<FixtureDocument[]> {
  return Fixture.find({ reporter_user_id: requestingUser.id }).sort({ datetime: 1 });
}

export async function getFixture(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureDocument> {
  const fixture = await Fixture.findOne({ _id: fixtureId, ...organizationScopeFilter(requestingUser) });
  if (!fixture) {
    throw new AppError("Fixture not found", 404);
  }
  return fixture;
}

/** FR18: schedule a fixture within a competition the caller has access to. */
export async function createFixture(
  requestingUser: RequestingUser,
  input: CreateFixtureInput,
): Promise<FixtureDocument> {
  const competition = await getCompetition(requestingUser, input.competition_id);

  const homeEntry = await resolveEntryForCompetition(competition, input.home_entry_id);
  const awayEntry = await resolveEntryForCompetition(competition, input.away_entry_id);
  if (homeEntry._id.equals(awayEntry._id)) {
    throw new AppError("home_entry_id and away_entry_id must be different", 400);
  }

  const venueId = await resolveVenueInOrganization(competition.organization_id, input.venue_id);

  const fixture = await Fixture.create({
    organization_id: competition.organization_id,
    competition_id: competition._id,
    home_entry_id: homeEntry._id,
    away_entry_id: awayEntry._id,
    venue_id: venueId,
    datetime: input.datetime,
    status: input.status ?? "scheduled",
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: competition.organization_id,
    action: "create",
    resource_type: "Fixture",
    resource_id: fixture._id,
    after: fixture.toJSON(),
  });

  return fixture;
}

export async function updateFixture(
  requestingUser: RequestingUser,
  fixtureId: string,
  input: UpdateFixtureInput,
): Promise<FixtureDocument> {
  const fixture = await getFixture(requestingUser, fixtureId);
  const before = fixture.toJSON();

  if (input.home_entry_id !== undefined || input.away_entry_id !== undefined) {
    const competition = await getCompetition(requestingUser, fixture.competition_id.toString());
    if (input.home_entry_id !== undefined) {
      fixture.home_entry_id = (await resolveEntryForCompetition(competition, input.home_entry_id))._id;
    }
    if (input.away_entry_id !== undefined) {
      fixture.away_entry_id = (await resolveEntryForCompetition(competition, input.away_entry_id))._id;
    }
    if (fixture.home_entry_id.equals(fixture.away_entry_id)) {
      throw new AppError("home_entry_id and away_entry_id must be different", 400);
    }
  }
  if (input.venue_id !== undefined) {
    fixture.venue_id = await resolveVenueInOrganization(fixture.organization_id, input.venue_id);
  }
  if (input.datetime !== undefined) {
    fixture.datetime = input.datetime;
  }
  if (input.status !== undefined) {
    fixture.status = input.status;
  }

  await fixture.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "update",
    resource_type: "Fixture",
    resource_id: fixture._id,
    before,
    after: fixture.toJSON(),
  });

  return fixture;
}

export async function deleteFixture(requestingUser: RequestingUser, fixtureId: string): Promise<void> {
  const fixture = await getFixture(requestingUser, fixtureId);
  const before = fixture.toJSON();

  await fixture.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "delete",
    resource_type: "Fixture",
    resource_id: fixture._id,
    before,
  });
}

/** FR19: assigning a reporter is a separate, reporter.assign gated action — not part of the general fixture.manage update. */
export async function assignReporter(
  requestingUser: RequestingUser,
  fixtureId: string,
  userId: string,
): Promise<FixtureDocument> {
  const fixture = await getFixture(requestingUser, fixtureId);
  const before = fixture.toJSON();

  const reporter = await User.findOne({ _id: userId, organization_id: fixture.organization_id });
  if (!reporter) {
    throw new AppError("User not found in this Organization", 400);
  }

  fixture.reporter_user_id = reporter._id;
  await fixture.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "update",
    resource_type: "Fixture",
    resource_id: fixture._id,
    before,
    after: fixture.toJSON(),
  });

  return fixture;
}

export async function unassignReporter(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureDocument> {
  const fixture = await getFixture(requestingUser, fixtureId);
  const before = fixture.toJSON();

  fixture.reporter_user_id = null;
  await fixture.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: fixture.organization_id,
    action: "update",
    resource_type: "Fixture",
    resource_id: fixture._id,
    before,
    after: fixture.toJSON(),
  });

  return fixture;
}

async function resolveEntryForCompetition(
  competition: CompetitionDocument,
  entryId: string,
): Promise<CompetitionEntryDocument> {
  const entry = await CompetitionEntry.findOne({ _id: entryId, competition_id: competition._id });
  if (!entry) {
    throw new AppError("Competition entry not found in this Competition", 400);
  }
  return entry;
}
