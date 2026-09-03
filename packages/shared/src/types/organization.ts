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
