import type { Contact } from "./common";

export const ORGANIZATION_TYPES = [
  "federation",
  "confederation",
  "league_operator",
  "competition_organizer",
] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  country: string | null;
  confederation: string | null;
  contact: Contact;
  createdAt: string;
  updatedAt: string;
}

// FR33: just enough to populate the fan-facing "browse by country /
// confederation / organization" filters — no contact details, which aren't
// public information the way an Organization's name/country/confederation
// are.
export interface PublicOrganizationSummary {
  id: string;
  name: string;
  country: string | null;
  confederation: string | null;
}
