export const PLAYER_POSITIONS = ["goalkeeper", "defender", "midfielder", "forward"] as const;

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number];

// A person record. Which team(s) they're on, and for which season(s), is
// tracked by RosterEntry — see roster-entry.ts.
export interface Player {
  id: string;
  organization_id: string;
  name: string;
  position: PlayerPosition;
  date_of_birth: string;
  createdAt: string;
  updatedAt: string;
}
