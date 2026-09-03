import type { Location } from "./common";

export interface Venue {
  id: string;
  organization_id: string;
  name: string;
  location: Location;
  createdAt: string;
  updatedAt: string;
}
