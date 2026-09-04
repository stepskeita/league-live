// FR20: a Player's membership on a Team's roster for one season. A Player
// can have multiple RosterEntry records over their career — one per
// team/season — rather than one fixed team.
export interface RosterEntry {
  id: string;
  organization_id: string;
  team_id: string;
  player_id: string;
  season: string;
  createdAt: string;
  updatedAt: string;
}
