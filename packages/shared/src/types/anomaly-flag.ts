// FR40: "The system flags anomalies for review" — system generated, not a
// manual "report this" action a user takes, so there's no create endpoint
// for these, only listing and resolving. The specific checks implemented
// (anomaly-flag.service.ts) are a deliberately small, illustrative set —
// FR40 doesn't specify what counts as an anomaly, and a real
// anomaly-detection system is well beyond this task's scope.
export const ANOMALY_FLAG_REASONS = ["duplicate_session_event", "unusually_high_score"] as const;

export type AnomalyFlagReason = (typeof ANOMALY_FLAG_REASONS)[number];

export const ANOMALY_FLAG_STATUSES = ["open", "resolved"] as const;

export type AnomalyFlagStatus = (typeof ANOMALY_FLAG_STATUSES)[number];

export interface AnomalyFlag {
  id: string;
  organization_id: string;
  fixture_id: string;
  // Set when the anomaly is about one specific event; null for a
  // fixture-level anomaly (e.g. an aggregate score check).
  match_event_id: string | null;
  reason: AnomalyFlagReason;
  details: string;
  status: AnomalyFlagStatus;
  resolved_by_user_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  createdAt: string;
  updatedAt: string;
}
