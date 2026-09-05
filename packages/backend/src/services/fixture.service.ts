import type { FixtureStatus, LiveFixtureSummary } from "@leaguelive/shared";
import { Types } from "mongoose";
import { CompetitionEntry, type CompetitionEntryDocument } from "../models/competition-entry.model";
import { Competition, type CompetitionDocument } from "../models/competition.model";
import { Fixture, type FixtureDocument } from "../models/fixture.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { getCompetition } from "./competition.service";
import { getLiveMatchState, refreshAndBroadcastLiveMatchState } from "./live-match-state.service";
import { countGoalsByTeam } from "./match-score.service";
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

export interface ListLiveFixturesInput {
  organization_id?: string;
  country?: string;
  category?: string;
}

/**
 * FR32: fans browsing live scores across every in-progress fixture on the
 * platform — not the single-fixture getFixtureLiveState, this is the
 * listing it's meant to be reached from. Public, same as that endpoint.
 * `country` and `category` aren't fields on Fixture itself (they live on
 * Organization and Competition respectively), so they're resolved to a set
 * of ids first rather than denormalized onto Fixture just for this filter.
 */
export async function listLiveFixtures(input: ListLiveFixturesInput): Promise<LiveFixtureSummary[]> {
  const conditions: Record<string, unknown>[] = [{ status: "in_progress" }];

  if (input.organization_id) {
    conditions.push({ organization_id: new Types.ObjectId(input.organization_id) });
  }
  if (input.country) {
    const organizationIds = await Organization.find({ country: input.country }).distinct("_id");
    conditions.push({ organization_id: { $in: organizationIds } });
  }
  if (input.category) {
    const competitionIds = await Competition.find({ category: input.category }).distinct("_id");
    conditions.push({ competition_id: { $in: competitionIds } });
  }

  const filter = conditions.length === 1 ? conditions[0]! : { $and: conditions };
  const fixtures = await Fixture.find(filter).sort({ datetime: 1 });

  return Promise.all(
    fixtures.map(async (fixture): Promise<LiveFixtureSummary> => ({
      fixture_id: fixture._id.toString(),
      organization_id: fixture.organization_id.toString(),
      competition_id: fixture.competition_id.toString(),
      home_entry_id: fixture.home_entry_id.toString(),
      away_entry_id: fixture.away_entry_id.toString(),
      venue_id: fixture.venue_id ? fixture.venue_id.toString() : null,
      datetime: fixture.datetime.toISOString(),
      liveMatchState: await getLiveMatchState(fixture._id.toString()),
    })),
  );
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

// --- FR25-FR28: match reporting ---

/**
 * The authorization boundary for a Reporter's own actions (start/end
 * session, log events) — not an organization-scoped permission check like
 * everywhere else, but "are you *the* reporter this fixture was assigned
 * to." Exported so match-event.service.ts can reuse it rather than
 * reimplementing the same check.
 */
export function requireAssignedReporter(fixture: FixtureDocument, requestingUser: RequestingUser): void {
  if (!fixture.reporter_user_id || fixture.reporter_user_id.toString() !== requestingUser.id) {
    throw new AppError("You are not the assigned reporter for this fixture", 403);
  }
}

export async function getFixtureForReporter(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureDocument> {
  const fixture = await Fixture.findById(fixtureId);
  if (!fixture) {
    throw new AppError("Fixture not found", 404);
  }
  requireAssignedReporter(fixture, requestingUser);
  return fixture;
}

/** FR25: idempotent — retrying an already-started session is a no-op, not an error (FR27's offline-retry concern applies here too). */
export async function startMatchSession(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureDocument> {
  const fixture = await getFixtureForReporter(requestingUser, fixtureId);

  if (fixture.status === "in_progress") {
    return fixture;
  }
  if (fixture.status !== "scheduled") {
    throw new AppError(`Cannot start a match session for a fixture with status "${fixture.status}"`, 400);
  }

  const before = fixture.toJSON();
  fixture.status = "in_progress";
  fixture.started_at = new Date();
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

  await refreshAndBroadcastLiveMatchState(fixture._id.toString());

  return fixture;
}

/** FR25: idempotent, same reasoning as startMatchSession. Ending a session does not itself lock the result — see confirmResult (FR28). */
export async function endMatchSession(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureDocument> {
  const fixture = await getFixtureForReporter(requestingUser, fixtureId);

  if (fixture.status === "completed") {
    return fixture;
  }
  if (fixture.status !== "in_progress") {
    throw new AppError(`Cannot end a match session for a fixture with status "${fixture.status}"`, 400);
  }

  const before = fixture.toJSON();
  fixture.status = "completed";
  fixture.ended_at = new Date();
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

  await refreshAndBroadcastLiveMatchState(fixture._id.toString());

  return fixture;
}

/**
 * FR28: results.verify gated, distinct from match.report — the reporter who
 * covered the match and the person who confirms its official result don't
 * have to be the same permission holder. Computes the final score by
 * counting "goal" MatchEvents per side and locks it; once locked, no more
 * MatchEvents may be logged (see match-event.service.ts).
 */
export async function confirmResult(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureDocument> {
  const fixture = await getFixture(requestingUser, fixtureId);

  if (fixture.status !== "completed") {
    throw new AppError("Fixture must be completed (its match session ended) before its result can be confirmed", 400);
  }
  if (fixture.result_locked_at) {
    throw new AppError("This fixture's result is already locked", 409);
  }

  const { home: homeGoals, away: awayGoals } = await countGoalsByTeam(fixture);

  const before = fixture.toJSON();
  fixture.home_score = homeGoals;
  fixture.away_score = awayGoals;
  fixture.result_locked_at = new Date();
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

  await refreshAndBroadcastLiveMatchState(fixture._id.toString());

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
