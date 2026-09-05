import type { AnomalyFlagReason } from "@leaguelive/shared";
import { Types } from "mongoose";
import { AnomalyFlag, type AnomalyFlagDocument } from "../models/anomaly-flag.model";
import type { FixtureDocument } from "../models/fixture.model";
import { MatchEvent, type MatchEventDocument } from "../models/match-event.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { countGoalsByTeam } from "./match-score.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

// A very generous sanity bound — a real match essentially never reaches
// this, so tripping it means a data-entry error far more often than a
// genuinely lopsided result. Named and isolated here so it's easy to find
// and tune, not buried inline.
const HIGH_SCORE_THRESHOLD = 15;

async function flagIfNotAlreadyOpen(input: {
  organization_id: Types.ObjectId;
  fixture_id: Types.ObjectId;
  match_event_id: Types.ObjectId | null;
  reason: AnomalyFlagReason;
  details: string;
}): Promise<void> {
  const existing = await AnomalyFlag.findOne({
    fixture_id: input.fixture_id,
    reason: input.reason,
    status: "open",
  });
  if (existing) {
    return;
  }

  await AnomalyFlag.create({
    organization_id: input.organization_id,
    fixture_id: input.fixture_id,
    match_event_id: input.match_event_id,
    reason: input.reason,
    details: input.details,
    status: "open",
  });
}

/**
 * FR40, best-effort: called from match-event.service.ts's createMatchEvent
 * right after a genuinely new event is logged. Deliberately never allowed
 * to fail the reporter's submission — a missed anomaly check is a degraded
 * moderation experience, not a broken mutation, same reasoning as
 * live-match-state.service.ts's broadcast being best-effort. Not
 * audit-logged: this is a system side effect of a request, not itself a
 * user-initiated action (the original MatchEvent creation already has its
 * own audit entry) — resolving a flag, a genuine verifier decision, is what
 * gets logged.
 */
export async function detectMatchEventAnomalies(fixture: FixtureDocument, event: MatchEventDocument): Promise<void> {
  try {
    if (event.type === "half_time" || event.type === "full_time") {
      const count = await MatchEvent.countDocuments({ fixture_id: fixture._id, type: event.type });
      if (count > 1) {
        await flagIfNotAlreadyOpen({
          organization_id: fixture.organization_id,
          fixture_id: fixture._id,
          match_event_id: event._id,
          reason: "duplicate_session_event",
          details: `More than one "${event.type}" event has been logged for this fixture.`,
        });
      }
    }

    if (event.type === "goal") {
      const goals = await countGoalsByTeam(fixture);
      if (goals.home > HIGH_SCORE_THRESHOLD || goals.away > HIGH_SCORE_THRESHOLD) {
        await flagIfNotAlreadyOpen({
          organization_id: fixture.organization_id,
          fixture_id: fixture._id,
          match_event_id: event._id,
          reason: "unusually_high_score",
          details: `Goal count (${goals.home}-${goals.away}) exceeds the sanity threshold of ${HIGH_SCORE_THRESHOLD} for one side.`,
        });
      }
    }
  } catch (err) {
    console.error(`Failed to run anomaly detection for fixture ${fixture._id.toString()}:`, err);
  }
}

export interface ListAnomalyFlagsInput {
  status?: "open" | "resolved";
  fixture_id?: string;
}

export async function listAnomalyFlags(
  requestingUser: RequestingUser,
  input: ListAnomalyFlagsInput,
): Promise<AnomalyFlagDocument[]> {
  const filter: Record<string, unknown> = { ...organizationScopeFilter(requestingUser) };
  if (input.status) {
    filter.status = input.status;
  }
  if (input.fixture_id) {
    filter.fixture_id = input.fixture_id;
  }
  return AnomalyFlag.find(filter).sort({ createdAt: -1 });
}

export async function getAnomalyFlag(requestingUser: RequestingUser, flagId: string): Promise<AnomalyFlagDocument> {
  const flag = await AnomalyFlag.findOne({ _id: flagId, ...organizationScopeFilter(requestingUser) });
  if (!flag) {
    throw new AppError("Anomaly flag not found", 404);
  }
  return flag;
}

export async function resolveAnomalyFlag(
  requestingUser: RequestingUser,
  flagId: string,
  resolutionNote?: string,
): Promise<AnomalyFlagDocument> {
  const flag = await getAnomalyFlag(requestingUser, flagId);
  if (flag.status === "resolved") {
    throw new AppError("This anomaly flag is already resolved", 409);
  }
  const before = flag.toJSON();

  flag.status = "resolved";
  flag.resolved_by_user_id = new Types.ObjectId(requestingUser.id);
  flag.resolution_note = resolutionNote ?? null;
  flag.resolved_at = new Date();
  await flag.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: flag.organization_id,
    action: "update",
    resource_type: "AnomalyFlag",
    resource_id: flag._id,
    before,
    after: flag.toJSON(),
  });

  return flag;
}
