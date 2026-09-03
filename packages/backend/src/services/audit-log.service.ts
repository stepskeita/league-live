import type { AuditAction } from "@leaguelive/shared";
import { Types } from "mongoose";
import { AuditLogEntry, type AuditLogEntryDocument } from "../models/audit-log-entry.model";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

export interface RecordAuditLogEntryInput {
  actor_user_id: Types.ObjectId | string;
  // The Organization the affected resource belongs to — see
  // AuditLogEntryAttrs.organization_id for why this isn't just the actor's
  // own organization_id.
  organization_id: Types.ObjectId | string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: Types.ObjectId | string;
  before?: unknown;
  after?: unknown;
}

/**
 * FR10: every significant action is written to an audit log entry. This is
 * the one place that knows how — callers (role.service.ts, auth.service.ts,
 * and anything mutating in future) call this once per mutation rather than
 * each building its own AuditLogEntry write.
 *
 * Called synchronously as part of the mutating request, after the mutation
 * itself succeeds, and awaited by the caller: if this throws, the request
 * fails too. A mutation whose audit trail silently failed to write is worse
 * than a mutation that fails loudly, given FR10/FR11/NFR6's compliance
 * intent.
 */
export async function recordAuditLogEntry(input: RecordAuditLogEntryInput): Promise<AuditLogEntryDocument> {
  return AuditLogEntry.create({
    actor_user_id: input.actor_user_id,
    organization_id: input.organization_id,
    action: input.action,
    resource_type: input.resource_type,
    resource_id: input.resource_id.toString(),
    before: input.before,
    after: input.after,
  });
}

export interface ListAuditLogEntriesInput {
  // Only meaningful for a Platform Operator (organization_id: null); an
  // org-scoped caller always sees only their own Organization's entries.
  organization_id?: string;
  before?: Date;
  limit?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function listAuditLogEntries(
  requestingUser: RequestingUser,
  input: ListAuditLogEntriesInput,
): Promise<AuditLogEntryDocument[]> {
  const filter: Record<string, unknown> = { ...organizationScopeFilter(requestingUser) };

  if (!requestingUser.organization_id && input.organization_id) {
    filter.organization_id = new Types.ObjectId(input.organization_id);
  }
  if (input.before) {
    filter.timestamp = { $lt: input.before };
  }

  const limit = Math.min(input.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  return AuditLogEntry.find(filter).sort({ timestamp: -1 }).limit(limit);
}

export async function getAuditLogEntry(requestingUser: RequestingUser, entryId: string): Promise<AuditLogEntryDocument> {
  const entry = await AuditLogEntry.findOne({ _id: entryId, ...organizationScopeFilter(requestingUser) });
  if (!entry) {
    throw new AppError("Audit log entry not found", 404);
  }
  return entry;
}
