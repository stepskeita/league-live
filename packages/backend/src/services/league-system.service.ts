import type { LeagueSystemRules } from "@leaguelive/shared";
import { Types } from "mongoose";
import { CompetitionEntry, type CompetitionEntryDocument } from "../models/competition-entry.model";
import { CompetitionStanding, type CompetitionStandingDocument } from "../models/competition-standing.model";
import { Competition } from "../models/competition.model";
import { LeagueSystem, type LeagueSystemDocument } from "../models/league-system.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { resolveOrganizationScopeForCreate } from "./organization.service";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface CreateLeagueSystemInput {
  name: string;
  scope: string;
  rules: LeagueSystemRules;
  tiers?: string[];
  // Only meaningful for a Platform Operator; an org-scoped caller can only
  // ever create a League System in their own Organization.
  organization_id?: string;
}

export interface UpdateLeagueSystemInput {
  name?: string;
  scope?: string;
  rules?: LeagueSystemRules;
}

export async function listLeagueSystems(requestingUser: RequestingUser): Promise<LeagueSystemDocument[]> {
  return LeagueSystem.find(organizationScopeFilter(requestingUser)).sort({ name: 1 });
}

export async function getLeagueSystem(requestingUser: RequestingUser, leagueSystemId: string): Promise<LeagueSystemDocument> {
  const leagueSystem = await LeagueSystem.findOne({ _id: leagueSystemId, ...organizationScopeFilter(requestingUser) });
  if (!leagueSystem) {
    throw new AppError("League System not found", 404);
  }
  return leagueSystem;
}

export async function createLeagueSystem(
  requestingUser: RequestingUser,
  input: CreateLeagueSystemInput,
): Promise<LeagueSystemDocument> {
  const organizationId = await resolveOrganizationScopeForCreate(requestingUser, input.organization_id);
  const tierIds = await resolveTiersInOrganization(organizationId, input.tiers ?? []);

  let leagueSystem: LeagueSystemDocument;
  try {
    leagueSystem = await LeagueSystem.create({
      organization_id: organizationId,
      name: input.name,
      scope: input.scope,
      rules: input.rules,
      tiers: tierIds,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("A League System with this name already exists in this Organization", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "LeagueSystem",
    resource_id: leagueSystem._id,
    after: leagueSystem.toJSON(),
  });

  return leagueSystem;
}

export async function updateLeagueSystem(
  requestingUser: RequestingUser,
  leagueSystemId: string,
  input: UpdateLeagueSystemInput,
): Promise<LeagueSystemDocument> {
  const leagueSystem = await getLeagueSystem(requestingUser, leagueSystemId);
  const before = leagueSystem.toJSON();

  if (input.name !== undefined) {
    leagueSystem.name = input.name;
  }
  if (input.scope !== undefined) {
    leagueSystem.scope = input.scope;
  }
  if (input.rules !== undefined) {
    leagueSystem.rules = input.rules;
  }

  try {
    await leagueSystem.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("A League System with this name already exists in this Organization", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: leagueSystem.organization_id,
    action: "update",
    resource_type: "LeagueSystem",
    resource_id: leagueSystem._id,
    before,
    after: leagueSystem.toJSON(),
  });

  return leagueSystem;
}

export async function deleteLeagueSystem(requestingUser: RequestingUser, leagueSystemId: string): Promise<void> {
  const leagueSystem = await getLeagueSystem(requestingUser, leagueSystemId);
  const before = leagueSystem.toJSON();

  // A League System only *links* Competitions as tiers — it doesn't own
  // them, unlike e.g. deleteCompetition owning its CompetitionEntry records.
  // Deleting the linking structure leaves the Competitions themselves
  // untouched, so there's nothing to cascade or block here.
  await leagueSystem.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: leagueSystem.organization_id,
    action: "delete",
    resource_type: "LeagueSystem",
    resource_id: leagueSystem._id,
    before,
  });
}

/** FR21: the dedicated "link competitions into a league system" action — replaces the whole ordered tier list in one call. */
export async function setTiers(
  requestingUser: RequestingUser,
  leagueSystemId: string,
  competitionIds: string[],
): Promise<LeagueSystemDocument> {
  const leagueSystem = await getLeagueSystem(requestingUser, leagueSystemId);
  const before = leagueSystem.toJSON();

  leagueSystem.tiers = await resolveTiersInOrganization(leagueSystem.organization_id, competitionIds);
  await leagueSystem.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: leagueSystem.organization_id,
    action: "update",
    resource_type: "LeagueSystem",
    resource_id: leagueSystem._id,
    before,
    after: leagueSystem.toJSON(),
  });

  return leagueSystem;
}

async function resolveTiersInOrganization(organizationId: Types.ObjectId, competitionIds: string[]): Promise<Types.ObjectId[]> {
  if (new Set(competitionIds).size !== competitionIds.length) {
    throw new AppError("tiers must not contain duplicate competitions", 400);
  }
  if (competitionIds.length === 0) {
    return [];
  }

  const count = await Competition.countDocuments({ _id: { $in: competitionIds }, organization_id: organizationId });
  if (count !== competitionIds.length) {
    throw new AppError("One or more competitions were not found in this Organization", 400);
  }

  // Preserve the caller's requested order — $in does not guarantee it.
  return competitionIds.map((id) => new Types.ObjectId(id));
}

// --- FR22/FR23: promotion & relegation ---

export interface TierMovement {
  competition_entry_id: Types.ObjectId;
  from_competition_id: Types.ObjectId;
  to_competition_id: Types.ObjectId;
  direction: "promoted" | "relegated";
}

/**
 * Pure computation, no DB access: given a League System's ordered tiers and
 * promotion/relegation rules, and a locked final standing for every tier,
 * determines which CompetitionEntry moves up or down between adjacent
 * tiers. The rule is applied uniformly at every tier boundary — FR22 says
 * "between adjacent tiers", and FR21's own example ("top N promoted, bottom
 * N relegated") describes one rule, not a per-boundary configuration.
 */
export function computePromotionRelegation(
  leagueSystem: LeagueSystemDocument,
  standingsByCompetitionId: Map<string, CompetitionStandingDocument>,
): TierMovement[] {
  const { promote_count, relegate_count } = leagueSystem.rules;
  const movements: TierMovement[] = [];

  for (let i = 0; i < leagueSystem.tiers.length - 1; i++) {
    const higherCompetitionId = leagueSystem.tiers[i];
    const lowerCompetitionId = leagueSystem.tiers[i + 1];
    if (!higherCompetitionId || !lowerCompetitionId) {
      // Unreachable given the loop bounds — satisfies noUncheckedIndexedAccess.
      throw new AppError(`Missing tier ${i + 1} or ${i + 2}`, 400);
    }

    const higherStanding = standingsByCompetitionId.get(higherCompetitionId.toString());
    const lowerStanding = standingsByCompetitionId.get(lowerCompetitionId.toString());
    if (!higherStanding || !lowerStanding) {
      throw new AppError(`Missing a locked standing for tier ${i + 1} or ${i + 2}`, 400);
    }

    if (relegate_count > higherStanding.entries.length) {
      throw new AppError(
        `Cannot relegate ${relegate_count} teams from tier ${i + 1}, which only has ${higherStanding.entries.length} standing entries`,
        400,
      );
    }
    if (promote_count > lowerStanding.entries.length) {
      throw new AppError(
        `Cannot promote ${promote_count} teams from tier ${i + 2}, which only has ${lowerStanding.entries.length} standing entries`,
        400,
      );
    }

    const relegated = higherStanding.entries.slice(higherStanding.entries.length - relegate_count);
    for (const entryId of relegated) {
      movements.push({
        competition_entry_id: entryId,
        from_competition_id: higherCompetitionId,
        to_competition_id: lowerCompetitionId,
        direction: "relegated",
      });
    }

    const promoted = lowerStanding.entries.slice(0, promote_count);
    for (const entryId of promoted) {
      movements.push({
        competition_entry_id: entryId,
        from_competition_id: lowerCompetitionId,
        to_competition_id: higherCompetitionId,
        direction: "promoted",
      });
    }
  }

  return movements;
}

export interface EndSeasonStandingInput {
  competition_id: string;
  // Ordered CompetitionEntry ids, best to worst.
  entries: string[];
}

export interface EndSeasonInput {
  season: string;
  // One entry per tier, in tier order.
  standings: EndSeasonStandingInput[];
  // One Competition id per tier, in tier order — the tier's competition for
  // the *following* season, into which moved teams' entries are created.
  next_season_competition_ids: string[];
}

export interface EndSeasonResult {
  standings: CompetitionStandingDocument[];
  movements: TierMovement[];
  newEntries: CompetitionEntryDocument[];
}

/**
 * FR22/FR23, triggered manually: never by a scheduled job. The platform has
 * no reliable way to know a season is actually over, so this is always a
 * deliberate admin action — locks each tier's final standing (as submitted
 * by the caller: there's no match-result data yet to derive it from),
 * computes promotion/relegation, and creates the moved teams' entries in
 * their new tier's competition for the following season. Everything is
 * validated up front, before any writes, to keep the (non-transactional)
 * partial-failure window as small as possible.
 */
export async function endSeason(
  requestingUser: RequestingUser,
  leagueSystemId: string,
  input: EndSeasonInput,
): Promise<EndSeasonResult> {
  const leagueSystem = await getLeagueSystem(requestingUser, leagueSystemId);

  if (leagueSystem.tiers.length < 2) {
    throw new AppError("A League System needs at least 2 tiers to end a season", 400);
  }
  if (input.standings.length !== leagueSystem.tiers.length) {
    throw new AppError("standings must include exactly one entry per tier, in tier order", 400);
  }
  if (input.next_season_competition_ids.length !== leagueSystem.tiers.length) {
    throw new AppError("next_season_competition_ids must include exactly one competition id per tier, in tier order", 400);
  }

  const tierEntryIds: Types.ObjectId[][] = [];
  const nextSeasonCompetitionIds: Types.ObjectId[] = [];

  for (let i = 0; i < leagueSystem.tiers.length; i++) {
    const tierCompetitionId = leagueSystem.tiers[i];
    const standingInput = input.standings[i];
    const nextSeasonCompetitionIdInput = input.next_season_competition_ids[i];
    if (!tierCompetitionId || !standingInput || nextSeasonCompetitionIdInput === undefined) {
      // Unreachable given the length checks above — satisfies noUncheckedIndexedAccess.
      throw new AppError(`Missing input for tier ${i + 1}`, 400);
    }

    if (standingInput.competition_id !== tierCompetitionId.toString()) {
      throw new AppError(`standings[${i}].competition_id must match tier ${i + 1}'s competition (${tierCompetitionId.toString()})`, 400);
    }

    const alreadyLocked = await CompetitionStanding.exists({ competition_id: tierCompetitionId, season: input.season });
    if (alreadyLocked) {
      throw new AppError(`Standings for tier ${i + 1} and season "${input.season}" are already locked`, 409);
    }

    if (new Set(standingInput.entries).size !== standingInput.entries.length) {
      throw new AppError(`standings[${i}].entries must not contain duplicates`, 400);
    }
    const entryIds = standingInput.entries.map((id) => new Types.ObjectId(id));
    const matchingEntries = await CompetitionEntry.countDocuments({
      _id: { $in: entryIds },
      competition_id: tierCompetitionId,
    });
    if (matchingEntries !== entryIds.length) {
      throw new AppError(`standings[${i}].entries must all be entries in tier ${i + 1}'s competition`, 400);
    }
    tierEntryIds.push(entryIds);

    const nextSeasonCompetitionId = nextSeasonCompetitionIdInput;
    if (nextSeasonCompetitionId === tierCompetitionId.toString()) {
      throw new AppError(`next_season_competition_ids[${i}] must be a different Competition than the one being closed out`, 400);
    }
    const nextSeasonCompetition = await Competition.findOne({
      _id: nextSeasonCompetitionId,
      organization_id: leagueSystem.organization_id,
    });
    if (!nextSeasonCompetition) {
      throw new AppError(`next_season_competition_ids[${i}] was not found in this Organization`, 400);
    }
    nextSeasonCompetitionIds.push(nextSeasonCompetition._id);
  }

  // --- All validated; now lock each tier's standing. ---
  const lockedStandings: CompetitionStandingDocument[] = [];
  const standingsByCompetitionId = new Map<string, CompetitionStandingDocument>();

  for (let i = 0; i < leagueSystem.tiers.length; i++) {
    const tierCompetitionId = leagueSystem.tiers[i];
    const entryIds = tierEntryIds[i];
    if (!tierCompetitionId || !entryIds) {
      // Unreachable: tierEntryIds has one entry per tier, pushed in the loop above.
      throw new AppError(`Missing input for tier ${i + 1}`, 400);
    }

    const standing = await CompetitionStanding.create({
      organization_id: leagueSystem.organization_id,
      competition_id: tierCompetitionId,
      season: input.season,
      entries: entryIds,
    });
    lockedStandings.push(standing);
    standingsByCompetitionId.set(tierCompetitionId.toString(), standing);

    await recordAuditLogEntry({
      actor_user_id: requestingUser.id,
      organization_id: leagueSystem.organization_id,
      action: "create",
      resource_type: "CompetitionStanding",
      resource_id: standing._id,
      after: standing.toJSON(),
    });
  }

  // --- Compute promotion/relegation from the now-locked standings. ---
  const movements = computePromotionRelegation(leagueSystem, standingsByCompetitionId);

  // --- Move affected teams into their new tier's entries for next season. ---
  const newEntries: CompetitionEntryDocument[] = [];
  for (const movement of movements) {
    const oldEntry = await CompetitionEntry.findById(movement.competition_entry_id);
    if (!oldEntry) {
      continue;
    }

    const tierIndex = leagueSystem.tiers.findIndex((id) => id.equals(movement.to_competition_id));
    const nextSeasonCompetitionId = nextSeasonCompetitionIds[tierIndex];

    const existing = await CompetitionEntry.findOne({
      competition_id: nextSeasonCompetitionId,
      team_id: oldEntry.team_id,
    });
    if (existing) {
      newEntries.push(existing);
      continue;
    }

    let newEntry: CompetitionEntryDocument;
    try {
      newEntry = await CompetitionEntry.create({
        organization_id: leagueSystem.organization_id,
        competition_id: nextSeasonCompetitionId,
        team_id: oldEntry.team_id,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const raceEntry = await CompetitionEntry.findOne({
          competition_id: nextSeasonCompetitionId,
          team_id: oldEntry.team_id,
        });
        if (raceEntry) {
          newEntries.push(raceEntry);
          continue;
        }
      }
      throw err;
    }

    newEntries.push(newEntry);

    await recordAuditLogEntry({
      actor_user_id: requestingUser.id,
      organization_id: leagueSystem.organization_id,
      action: "create",
      resource_type: "CompetitionEntry",
      resource_id: newEntry._id,
      after: newEntry.toJSON(),
    });
  }

  return { standings: lockedStandings, movements, newEntries };
}
