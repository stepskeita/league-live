import type { RosterEntry } from "../types/roster-entry";
import type { Team } from "../types/team";
import type { ApiClient } from "./client";

export interface TeamResponse {
  team: Team;
}

export interface ListTeamsResponse {
  teams: Team[];
}

export interface CreateTeamInput {
  name: string;
  club_id: string;
  category: string;
  venue_id?: string | null;
  organization_id?: string;
}

export interface UpdateTeamInput {
  name?: string;
  category?: string;
  club_id?: string;
  venue_id?: string | null;
}

export interface RosterEntryResponse {
  rosterEntry: RosterEntry;
}

export interface ListRosterEntriesResponse {
  rosterEntries: RosterEntry[];
}

/** FR16/FR20, roster.manage gated. */
export function createTeamsApi(client: ApiClient) {
  return {
    list: () => client.get<ListTeamsResponse>("/teams"),
    get: (teamId: string) => client.get<TeamResponse>(`/teams/${teamId}`),
    create: (input: CreateTeamInput) => client.post<TeamResponse>("/teams", input),
    update: (teamId: string, input: UpdateTeamInput) => client.patch<TeamResponse>(`/teams/${teamId}`, input),
    delete: (teamId: string) => client.delete<void>(`/teams/${teamId}`),
    /** FR20: a team's player roster, optionally filtered to one season. */
    listRoster: (teamId: string, season?: string) =>
      client.get<ListRosterEntriesResponse>(`/teams/${teamId}/roster`, { season }),
    addToRoster: (teamId: string, input: { player_id: string; season: string }) =>
      client.post<RosterEntryResponse>(`/teams/${teamId}/roster`, input),
    removeFromRoster: (teamId: string, entryId: string) => client.delete<void>(`/teams/${teamId}/roster/${entryId}`),
  };
}

export type TeamsApi = ReturnType<typeof createTeamsApi>;
