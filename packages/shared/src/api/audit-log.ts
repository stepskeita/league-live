import type { AuditLogEntry } from "../types/audit-log-entry";
import type { ApiClient } from "./client";

export interface ListAuditLogEntriesResponse {
  auditLogEntries: AuditLogEntry[];
}

export interface AuditLogEntryResponse {
  auditLogEntry: AuditLogEntry;
}

export interface ListAuditLogEntriesInput {
  /** Only meaningful for a Platform Operator — an org-scoped caller always sees only their own Organization's entries. */
  organization_id?: string;
  /** ISO date string — pagination cursor, entries strictly before this timestamp. */
  before?: string;
  limit?: number;
}

/** FR12, audit.view gated. No update/delete methods exist here on purpose — append only (FR11), and there's no route to call anyway. */
export function createAuditLogApi(client: ApiClient) {
  return {
    list: (input: ListAuditLogEntriesInput = {}) =>
      client.get<ListAuditLogEntriesResponse>("/audit-log-entries", {
        organization_id: input.organization_id,
        before: input.before,
        limit: input.limit !== undefined ? String(input.limit) : undefined,
      }),
    get: (entryId: string) => client.get<AuditLogEntryResponse>(`/audit-log-entries/${entryId}`),
  };
}

export type AuditLogApi = ReturnType<typeof createAuditLogApi>;
