// FR17: joins a Competition to a Team. organization_id is the Competition's
// owning Organization (the side managing entries) — team_id may belong to a
// *different* Organization, since a competition can draw in teams from
// elsewhere on the platform.
export interface CompetitionEntry {
  id: string;
  organization_id: string;
  competition_id: string;
  team_id: string;
  createdAt: string;
  updatedAt: string;
}
