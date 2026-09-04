import { CompetitionEntry, type CompetitionEntryDocument } from "../models/competition-entry.model";
import { Fixture } from "../models/fixture.model";
import { Team } from "../models/team.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { getCompetition } from "./competition.service";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import type { RequestingUser } from "../utils/tenant-scope";

export interface AddCompetitionEntryInput {
  team_id: string;
}

/**
 * FR17: entries join a Competition to a Team, and the Team's
 * organization_id may differ from the Competition's — so, unlike every
 * other cross-reference in this codebase, this lookup is deliberately NOT
 * scoped by the requesting user's Organization. `getCompetition` (which
 * fetches through organizationScopeFilter) is what actually enforces the
 * requesting user can only manage entries for a competition they have
 * access to; the Team side is intentionally open to the whole platform.
 */
export async function listCompetitionEntries(
  requestingUser: RequestingUser,
  competitionId: string,
): Promise<CompetitionEntryDocument[]> {
  const competition = await getCompetition(requestingUser, competitionId);
  return CompetitionEntry.find({ competition_id: competition._id });
}

export async function addCompetitionEntry(
  requestingUser: RequestingUser,
  competitionId: string,
  input: AddCompetitionEntryInput,
): Promise<CompetitionEntryDocument> {
  const competition = await getCompetition(requestingUser, competitionId);

  const team = await Team.findById(input.team_id);
  if (!team) {
    throw new AppError("Team not found", 400);
  }

  const existing = await CompetitionEntry.findOne({ competition_id: competition._id, team_id: team._id });
  if (existing) {
    throw new AppError("Team is already entered in this Competition", 409);
  }

  let entry: CompetitionEntryDocument;
  try {
    entry = await CompetitionEntry.create({
      organization_id: competition.organization_id,
      competition_id: competition._id,
      team_id: team._id,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("Team is already entered in this Competition", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: competition.organization_id,
    action: "create",
    resource_type: "CompetitionEntry",
    resource_id: entry._id,
    after: entry.toJSON(),
  });

  return entry;
}

export async function removeCompetitionEntry(
  requestingUser: RequestingUser,
  competitionId: string,
  entryId: string,
): Promise<void> {
  const competition = await getCompetition(requestingUser, competitionId);

  const entry = await CompetitionEntry.findOne({ _id: entryId, competition_id: competition._id });
  if (!entry) {
    throw new AppError("Competition entry not found", 404);
  }

  const hasFixtures = await Fixture.exists({
    competition_id: competition._id,
    $or: [{ home_entry_id: entry._id }, { away_entry_id: entry._id }],
  });
  if (hasFixtures) {
    throw new AppError("Cannot remove a Competition entry that is still referenced by a Fixture", 409);
  }

  const before = entry.toJSON();
  await entry.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: competition.organization_id,
    action: "delete",
    resource_type: "CompetitionEntry",
    resource_id: entry._id,
    before,
  });
}
