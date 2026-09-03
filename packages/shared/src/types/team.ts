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
