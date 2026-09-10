import type { AnomalyFlag, AnomalyFlagStatus } from "../types/anomaly-flag";
import type { DisciplinaryRecordRow } from "../types/discipline";
import type { ApiClient } from "./client";

export interface ListAnomalyFlagsResponse {
  anomalyFlags: AnomalyFlag[];
}

export interface AnomalyFlagResponse {
  anomalyFlag: AnomalyFlag;
}

export interface ListAnomalyFlagsInput {
  status?: AnomalyFlagStatus;
  fixture_id?: string;
}

export interface ListDisciplinaryRecordsResponse {
  disciplinaryRecords: DisciplinaryRecordRow[];
}

export interface DisciplinaryRecordResponse {
  disciplinaryRecord: DisciplinaryRecordRow;
}

/** FR39-FR41, results.verify gated. No create route for flags — they're system generated (FR40), not user reported. */
export function createModerationApi(client: ApiClient) {
  return {
    listFlags: (input: ListAnomalyFlagsInput = {}) =>
      client.get<ListAnomalyFlagsResponse>("/moderation/flags", { status: input.status, fixture_id: input.fixture_id }),
    getFlag: (flagId: string) => client.get<AnomalyFlagResponse>(`/moderation/flags/${flagId}`),
    resolveFlag: (flagId: string, resolutionNote?: string) =>
      client.post<AnomalyFlagResponse>(`/moderation/flags/${flagId}/resolve`, { resolution_note: resolutionNote }),
    listDiscipline: (competitionId: string) =>
      client.get<ListDisciplinaryRecordsResponse>(`/moderation/competitions/${competitionId}/discipline`),
    getPlayerDiscipline: (competitionId: string, playerId: string) =>
      client.get<DisciplinaryRecordResponse>(`/moderation/competitions/${competitionId}/discipline/${playerId}`),
  };
}

export type ModerationApi = ReturnType<typeof createModerationApi>;
