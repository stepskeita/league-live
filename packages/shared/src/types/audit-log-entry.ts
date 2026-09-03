export const AUDIT_ACTIONS = ["create", "update", "delete"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogEntry {
  id: string;
  // The Organization whose data was affected — not necessarily the actor's
  // own Organization (a Platform Operator can act across every
  // Organization). Null for actions with no Organization scope.
  organization_id: string | null;
  actor_user_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}
