import type { FixtureContext, FixtureStatus, LiveFixtureSummary, PublicFixtureSummary } from "@leaguelive/shared";
import { Types } from "mongoose";
import { CompetitionEntry, type CompetitionEntryDocument } from "../models/competition-entry.model";
import { Competition, type CompetitionDocument } from "../models/competition.model";
import { Fixture, type FixtureDocument } from "../models/fixture.model";
import { Organization } from "../models/organization.model";
import { Team } from "../models/team.model";
import { User } from "../models/user.model";
import { Venue } from "../models/venue.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { getCompetition } from "./competition.service";
import { getLiveMatchState, refreshAndBroadcastLiveMatchState } from "./live-match-state.service";
import { countGoalsByTeam } from "./match-score.service";
import { notifyTeamFollowers } from "./notification.service";
import { getEffectivePermissions } from "./permission.service";
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
  round?: string | null;
}

export interface UpdateFixtureInput {
  home_entry_id?: string;
  away_entry_id?: string;
  venue_id?: string | null;
  datetime?: Date;
  status?: FixtureStatus;
  round?: string | null;
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

  const enrichmentById = await resolveFixtureEnrichment(fixtures);
  return Promise.all(
    fixtures.map(async (fixture): Promise<LiveFixtureSummary> => {
      const enrichment = enrichmentById.get(fixture._id.toString());
      return {
        fixture_id: fixture._id.toString(),
        organization_id: fixture.organization_id.toString(),
        organization_name: enrichment?.organization_name ?? "Unknown",
        competition_id: fixture.competition_id.toString(),
        competition_name: enrichment?.competition_name ?? "Unknown",
        category: enrichment?.category ?? "",
        season: enrichment?.season ?? "",
        home_team: enrichment?.home_team ?? { id: fixture.home_entry_id.toString(), name: "Unknown" },
        away_team: enrichment?.away_team ?? { id: fixture.away_entry_id.toString(), name: "Unknown" },
        venue: enrichment?.venue ?? null,
        datetime: fixture.datetime.toISOString(),
        liveMatchState: await getLiveMatchState(fixture._id.toString()),
      };
    }),
  );
}

export interface BrowseFixturesInput {
  organization_id?: string;
  country?: string;
  confederation?: string;
  competition_id?: string;
  category?: string;
  team_id?: string;
  /** YYYY-MM-DD — matches any fixture within that calendar day, UTC. */
  date?: string;
  status?: FixtureStatus;
  page?: number;
  limit?: number;
}

export interface BrowseFixturesResult {
  fixtures: PublicFixtureSummary[];
  total: number;
  page: number;
  limit: number;
}

const DEFAULT_BROWSE_LIMIT = 20;
const MAX_BROWSE_LIMIT = 100;

/**
 * FR33: fans browsing every fixture and result on the platform, filterable
 * across every dimension FR33 names — the broader counterpart to
 * listLiveFixtures above, which only covers in-progress matches and a
 * narrower filter set (FR32). None of country/confederation/category/
 * team_id are fields on Fixture itself, so — same approach as
 * listLiveFixtures — each is resolved to a set of ids first rather than
 * denormalized onto Fixture just for this filter. Public, same as every
 * other fan-facing read in this file.
 */
export async function browseFixtures(input: BrowseFixturesInput): Promise<BrowseFixturesResult> {
  const conditions: Record<string, unknown>[] = [];

  if (input.organization_id) {
    conditions.push({ organization_id: new Types.ObjectId(input.organization_id) });
  }
  if (input.country || input.confederation) {
    const organizationFilter: Record<string, unknown> = {};
    if (input.country) {
      organizationFilter.country = input.country;
    }
    if (input.confederation) {
      organizationFilter.confederation = input.confederation;
    }
    const organizationIds = await Organization.find(organizationFilter).distinct("_id");
    conditions.push({ organization_id: { $in: organizationIds } });
  }
  if (input.competition_id) {
    conditions.push({ competition_id: new Types.ObjectId(input.competition_id) });
  }
  if (input.category) {
    const competitionIds = await Competition.find({ category: input.category }).distinct("_id");
    conditions.push({ competition_id: { $in: competitionIds } });
  }
  if (input.team_id) {
    const entryIds = await CompetitionEntry.find({ team_id: input.team_id }).distinct("_id");
    conditions.push({ $or: [{ home_entry_id: { $in: entryIds } }, { away_entry_id: { $in: entryIds } }] });
  }
  if (input.date) {
    const start = new Date(`${input.date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    conditions.push({ datetime: { $gte: start, $lt: end } });
  }
  if (input.status) {
    conditions.push({ status: input.status });
  }

  const filter = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0]! : { $and: conditions };

  const page = input.page && input.page > 0 ? Math.floor(input.page) : 1;
  const limit = input.limit && input.limit > 0 ? Math.min(Math.floor(input.limit), MAX_BROWSE_LIMIT) : DEFAULT_BROWSE_LIMIT;

  const [total, fixtures] = await Promise.all([
    Fixture.countDocuments(filter),
    Fixture.find(filter)
      .sort({ datetime: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  const enrichmentById = await resolveFixtureEnrichment(fixtures);
  const summaries = fixtures.map((fixture): PublicFixtureSummary => {
    const enrichment = enrichmentById.get(fixture._id.toString());
    return {
      id: fixture._id.toString(),
      organization_id: fixture.organization_id.toString(),
      organization_name: enrichment?.organization_name ?? "Unknown",
      competition_id: fixture.competition_id.toString(),
      competition_name: enrichment?.competition_name ?? "Unknown",
      category: enrichment?.category ?? "",
      season: enrichment?.season ?? "",
      home_team: enrichment?.home_team ?? { id: fixture.home_entry_id.toString(), name: "Unknown" },
      away_team: enrichment?.away_team ?? { id: fixture.away_entry_id.toString(), name: "Unknown" },
      venue: enrichment?.venue ?? null,
      datetime: fixture.datetime.toISOString(),
      status: fixture.status,
      round: fixture.round,
      home_score: fixture.home_score,
      away_score: fixture.away_score,
      result_locked_at: fixture.result_locked_at ? fixture.result_locked_at.toISOString() : null,
    };
  });

  return { fixtures: summaries, total, page, limit };
}

interface FixtureEnrichment {
  organization_name: string;
  competition_name: string;
  category: string;
  season: string;
  home_team: { id: string; name: string };
  away_team: { id: string; name: string };
  venue: { id: string; name: string } | null;
}

/**
 * Batches every id lookup a page of fixtures needs (competition,
 * organization, both entries' teams, venue) into one round trip per
 * collection rather than resolving each fixture one at a time, and shared
 * between browseFixtures (FR33) and listLiveFixtures (FR32) above — both
 * need the exact same resolved-names shape, just merged with different
 * per-fixture fields (a locked result vs. a live score).
 */
async function resolveFixtureEnrichment(fixtures: FixtureDocument[]): Promise<Map<string, FixtureEnrichment>> {
  if (fixtures.length === 0) {
    return new Map();
  }

  const competitionIds = [...new Set(fixtures.map((fixture) => fixture.competition_id.toString()))];
  const organizationIds = [...new Set(fixtures.map((fixture) => fixture.organization_id.toString()))];
  const entryIds = [
    ...new Set(fixtures.flatMap((fixture) => [fixture.home_entry_id.toString(), fixture.away_entry_id.toString()])),
  ];
  const venueIds = [
    ...new Set(
      fixtures
        .map((fixture) => (fixture.venue_id ? fixture.venue_id.toString() : null))
        .filter((id): id is string => id !== null),
    ),
  ];

  const [competitions, organizations, entries, venues] = await Promise.all([
    Competition.find({ _id: { $in: competitionIds } }),
    Organization.find({ _id: { $in: organizationIds } }),
    CompetitionEntry.find({ _id: { $in: entryIds } }),
    Venue.find({ _id: { $in: venueIds } }),
  ]);

  const competitionById = new Map(competitions.map((competition) => [competition._id.toString(), competition]));
  const organizationById = new Map(organizations.map((organization) => [organization._id.toString(), organization]));
  const entryById = new Map(entries.map((entry) => [entry._id.toString(), entry]));
  const venueById = new Map(venues.map((venue) => [venue._id.toString(), venue]));

  const teamIds = [...new Set(entries.map((entry) => entry.team_id.toString()))];
  const teams = await Team.find({ _id: { $in: teamIds } });
  const teamById = new Map(teams.map((team) => [team._id.toString(), team]));

  const resolveTeamSummary = (entryId: Types.ObjectId): { id: string; name: string } => {
    const entry = entryById.get(entryId.toString());
    const team = entry ? teamById.get(entry.team_id.toString()) : undefined;
    return { id: team ? team._id.toString() : entryId.toString(), name: team?.name ?? "Unknown" };
  };

  const result = new Map<string, FixtureEnrichment>();
  for (const fixture of fixtures) {
    const competition = competitionById.get(fixture.competition_id.toString());
    const organization = organizationById.get(fixture.organization_id.toString());
    const venue = fixture.venue_id ? venueById.get(fixture.venue_id.toString()) : undefined;

    result.set(fixture._id.toString(), {
      organization_name: organization?.name ?? "Unknown",
      competition_name: competition?.name ?? "Unknown",
      category: competition?.category ?? "",
      season: competition?.season ?? "",
      home_team: resolveTeamSummary(fixture.home_entry_id),
      away_team: resolveTeamSummary(fixture.away_entry_id),
      venue: venue ? { id: venue._id.toString(), name: venue.name } : null,
    });
  }
  return result;
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
    round: input.round ?? null,
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
  if (input.round !== undefined) {
    fixture.round = input.round;
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

/**
 * FR26/FR39's shared authorization: a verifier (results.verify) can reach
 * any fixture within their Organization scope; a reporter (match.report)
 * only their own assigned one. Lives here rather than in
 * match-event.service.ts (which also uses it) because getFixtureContext
 * below needs the exact same resolution.
 */
export async function resolveFixtureForReporterOrVerifier(
  requestingUser: RequestingUser,
  fixtureId: string,
): Promise<FixtureDocument> {
  const permissions = requestingUser.permissions ?? (await getEffectivePermissions(requestingUser.id));
  if (permissions.includes("results.verify")) {
    return getFixture(requestingUser, fixtureId);
  }
  return getFixtureForReporter(requestingUser, fixtureId);
}

/**
 * The minimum a reporter's own app needs to render a match-session screen
 * that isn't just raw ids: which two Teams this fixture is between. Nothing
 * beyond that (no player rosters, no venue) — match-event.service.ts's
 * createMatchEvent only *requires* team_id, and this task is explicitly
 * about minimal required fields, so this endpoint resolves exactly the one
 * thing that's otherwise unresolvable by a match.report holder (Team reads
 * are gated behind roster.manage, CompetitionEntry reads behind
 * competition.manage — neither of which a plain Reporter holds).
 */
export async function getFixtureContext(requestingUser: RequestingUser, fixtureId: string): Promise<FixtureContext> {
  const fixture = await resolveFixtureForReporterOrVerifier(requestingUser, fixtureId);

  const [homeEntry, awayEntry] = await Promise.all([
    CompetitionEntry.findById(fixture.home_entry_id),
    CompetitionEntry.findById(fixture.away_entry_id),
  ]);
  if (!homeEntry || !awayEntry) {
    throw new AppError("This fixture's competition entries could not be resolved", 400);
  }

  const [homeTeam, awayTeam] = await Promise.all([Team.findById(homeEntry.team_id), Team.findById(awayEntry.team_id)]);
  if (!homeTeam || !awayTeam) {
    throw new AppError("This fixture's teams could not be resolved", 400);
  }

  return {
    fixture_id: fixture._id.toString(),
    home_team: { id: homeTeam._id.toString(), name: homeTeam.name },
    away_team: { id: awayTeam._id.toString(), name: awayTeam.name },
  };
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

  // FR36, best-effort — see match-event.service.ts's notifyGoal for the
  // same reasoning, just the full-time equivalent.
  await notifyFullTime(fixture);

  return fixture;
}

/** FR36: the full-time push, sent to both teams' followers with the official, locked score. */
async function notifyFullTime(fixture: FixtureDocument): Promise<void> {
  const [homeEntry, awayEntry] = await Promise.all([
    CompetitionEntry.findById(fixture.home_entry_id),
    CompetitionEntry.findById(fixture.away_entry_id),
  ]);
  if (!homeEntry || !awayEntry) {
    return;
  }
  const [homeTeam, awayTeam] = await Promise.all([Team.findById(homeEntry.team_id), Team.findById(awayEntry.team_id)]);
  if (!homeTeam || !awayTeam) {
    return;
  }

  const payload = {
    title: "Full Time",
    body: `${homeTeam.name} ${fixture.home_score}-${fixture.away_score} ${awayTeam.name}`,
    data: { fixture_id: fixture._id.toString() },
  };
  await Promise.all([
    notifyTeamFollowers(homeEntry.team_id.toString(), payload),
    notifyTeamFollowers(awayEntry.team_id.toString(), payload),
  ]);
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
