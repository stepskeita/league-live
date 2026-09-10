import type { CompetitionEntry } from "../types/competition-entry";
import type { CompetitionStanding } from "../types/competition-standing";
import type { LeagueSystem, LeagueSystemRules } from "../types/league-system";
import type { ApiClient } from "./client";

export interface LeagueSystemResponse {
  leagueSystem: LeagueSystem;
}

export interface ListLeagueSystemsResponse {
  leagueSystems: LeagueSystem[];
}

export interface CreateLeagueSystemInput {
  name: string;
  scope: string;
  rules: LeagueSystemRules;
  tiers?: string[];
  organization_id?: string;
}

export interface UpdateLeagueSystemInput {
  name?: string;
  scope?: string;
  rules?: LeagueSystemRules;
}

export type TierMovementDirection = "promoted" | "relegated";

export interface TierMovement {
  competition_entry_id: string;
  from_competition_id: string;
  to_competition_id: string;
  direction: TierMovementDirection;
}

export interface EndSeasonInput {
  season: string;
  /** One entry per tier, in tier order — the final standing (best to worst CompetitionEntry ids) the caller is confirming. */
  standings: { competition_id: string; entries: string[] }[];
  /** One Competition id per tier, in tier order — that tier's competition for the following season. */
  next_season_competition_ids: string[];
}

export interface EndSeasonResponse {
  standings: CompetitionStanding[];
  movements: TierMovement[];
  newEntries: CompetitionEntry[];
}

/** FR21-FR23, competition.manage gated. endSeason is always a deliberate, manually triggered admin action — never automatic (see league-system.service.ts). */
export function createLeagueSystemsApi(client: ApiClient) {
  return {
    list: () => client.get<ListLeagueSystemsResponse>("/league-systems"),
    get: (leagueSystemId: string) => client.get<LeagueSystemResponse>(`/league-systems/${leagueSystemId}`),
    create: (input: CreateLeagueSystemInput) => client.post<LeagueSystemResponse>("/league-systems", input),
    update: (leagueSystemId: string, input: UpdateLeagueSystemInput) =>
      client.patch<LeagueSystemResponse>(`/league-systems/${leagueSystemId}`, input),
    delete: (leagueSystemId: string) => client.delete<void>(`/league-systems/${leagueSystemId}`),
    /** The dedicated "link competitions into a league system" action — replaces the whole ordered tier list. */
    setTiers: (leagueSystemId: string, competitionIds: string[]) =>
      client.put<LeagueSystemResponse>(`/league-systems/${leagueSystemId}/tiers`, { competition_ids: competitionIds }),
    endSeason: (leagueSystemId: string, input: EndSeasonInput) =>
      client.post<EndSeasonResponse>(`/league-systems/${leagueSystemId}/end-season`, input),
  };
}

export type LeagueSystemsApi = ReturnType<typeof createLeagueSystemsApi>;
