import type { Club } from "../types/club";
import type { ApiClient } from "./client";

export interface ClubResponse {
  club: Club;
}

export interface ListClubsResponse {
  clubs: Club[];
}

export interface CreateClubInput {
  name: string;
  organization_id?: string;
}

export interface UpdateClubInput {
  name?: string;
}

/** FR16, roster.manage gated. */
export function createClubsApi(client: ApiClient) {
  return {
    list: () => client.get<ListClubsResponse>("/clubs"),
    get: (clubId: string) => client.get<ClubResponse>(`/clubs/${clubId}`),
    create: (input: CreateClubInput) => client.post<ClubResponse>("/clubs", input),
    update: (clubId: string, input: UpdateClubInput) => client.patch<ClubResponse>(`/clubs/${clubId}`, input),
    delete: (clubId: string) => client.delete<void>(`/clubs/${clubId}`),
  };
}

export type ClubsApi = ReturnType<typeof createClubsApi>;
