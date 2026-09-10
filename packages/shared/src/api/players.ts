import type { Player, PlayerPosition } from "../types/player";
import type { ApiClient } from "./client";

export interface PlayerResponse {
  player: Player;
}

export interface ListPlayersResponse {
  players: Player[];
}

export interface CreatePlayerInput {
  name: string;
  position: PlayerPosition;
  /** ISO date string, must be in the past. */
  date_of_birth: string;
  organization_id?: string;
}

export interface UpdatePlayerInput {
  name?: string;
  position?: PlayerPosition;
  date_of_birth?: string;
}

/** FR16/FR20, roster.manage gated. */
export function createPlayersApi(client: ApiClient) {
  return {
    list: () => client.get<ListPlayersResponse>("/players"),
    get: (playerId: string) => client.get<PlayerResponse>(`/players/${playerId}`),
    create: (input: CreatePlayerInput) => client.post<PlayerResponse>("/players", input),
    update: (playerId: string, input: UpdatePlayerInput) => client.patch<PlayerResponse>(`/players/${playerId}`, input),
    delete: (playerId: string) => client.delete<void>(`/players/${playerId}`),
  };
}

export type PlayersApi = ReturnType<typeof createPlayersApi>;
