export const PLAYER_POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

export interface Player {
  id: string;
  organization_id: string;
  team_id: string;
  name: string;
  position: PlayerPosition;
  date_of_birth: string;
  createdAt: string;
  updatedAt: string;
}
