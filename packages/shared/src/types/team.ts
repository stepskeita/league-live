export interface Team {
  id: string;
  organization_id: string;
  club_id: string;
  name: string;
  category: string;
  venue_id: string | null;
  createdAt: string;
  updatedAt: string;
}

// FR33: just enough to populate the fan-facing "browse by team" filter.
export interface PublicTeamSummary {
  id: string;
  organization_id: string;
  name: string;
  category: string;
}
