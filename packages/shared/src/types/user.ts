import type { Contact } from "./common";

export interface User {
  id: string;
  organization_id: string | null;
  name: string;
  contact: Contact;
  createdAt: string;
  updatedAt: string;
}
