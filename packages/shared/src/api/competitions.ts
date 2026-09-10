import type { CompetitionEntry } from "../types/competition-entry";
import type { Competition, CompetitionFormatConfig } from "../types/competition";
import type { CompetitionTableRow } from "../types/standings";
import type { ApiClient } from "./client";

export interface CompetitionResponse {
  competition: Competition;
}

export interface ListCompetitionsResponse {
  competitions: Competition[];
}

export interface CreateCompetitionInput {
  name: string;
  category: string;
  format: CompetitionFormatConfig;
  ruleset?: Record<string, unknown>;
  season: string;
  organization_id?: string;
}

export interface UpdateCompetitionInput {
  name?: string;
  category?: string;
  format?: CompetitionFormatConfig;
  ruleset?: Record<string, unknown>;
  season?: string;
}

export interface CompetitionEntryResponse {
  competitionEntry: CompetitionEntry;
}

export interface ListCompetitionEntriesResponse {
  competitionEntries: CompetitionEntry[];
}

export interface StandingsResponse {
  standings: CompetitionTableRow[];
}

/** FR13-FR17, competition.manage gated (entries too — FR17's team_id lookup is deliberately not Organization-scoped, see competition-entry.service.ts). Standings is the one public read here (FR31/FR34, fan-facing). */
export function createCompetitionsApi(client: ApiClient) {
  return {
    list: () => client.get<ListCompetitionsResponse>("/competitions"),
    get: (competitionId: string) => client.get<CompetitionResponse>(`/competitions/${competitionId}`),
    create: (input: CreateCompetitionInput) => client.post<CompetitionResponse>("/competitions", input),
    update: (competitionId: string, input: UpdateCompetitionInput) =>
      client.patch<CompetitionResponse>(`/competitions/${competitionId}`, input),
    delete: (competitionId: string) => client.delete<void>(`/competitions/${competitionId}`),
    listEntries: (competitionId: string) =>
      client.get<ListCompetitionEntriesResponse>(`/competitions/${competitionId}/entries`),
    addEntry: (competitionId: string, teamId: string) =>
      client.post<CompetitionEntryResponse>(`/competitions/${competitionId}/entries`, { team_id: teamId }),
    removeEntry: (competitionId: string, entryId: string) =>
      client.delete<void>(`/competitions/${competitionId}/entries/${entryId}`),
    /** Public — no token required. */
    getStandings: (competitionId: string) =>
      client.get<StandingsResponse>(`/competitions/${competitionId}/standings`, undefined, { auth: false }),
  };
}

export type CompetitionsApi = ReturnType<typeof createCompetitionsApi>;
