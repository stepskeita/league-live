import type { Organization, OrganizationType, PublicOrganizationSummary } from "../types/organization";
import type { Contact } from "../types/common";
import type { User } from "../types/user";
import type { ApiClient } from "./client";

export interface OrganizationResponse {
  organization: Organization;
}

export interface ListOrganizationsResponse {
  organizations: Organization[];
}

export interface ListPublicOrganizationsResponse {
  organizations: PublicOrganizationSummary[];
}

export interface CreateOrganizationInput {
  name: string;
  type: OrganizationType;
  country?: string | null;
  confederation?: string | null;
  contact: Contact;
  admin: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  };
}

export interface CreateOrganizationResponse {
  organization: Organization;
  adminUser: User;
}

export interface UpdateOrganizationInput {
  name?: string;
  type?: OrganizationType;
  country?: string | null;
  confederation?: string | null;
  contact?: Contact;
}

/** FR1/FR2, Platform Operator only (organization.manage is platform scoped) — see organizations.ts's router comment on the backend. */
export function createOrganizationsApi(client: ApiClient) {
  return {
    list: () => client.get<ListOrganizationsResponse>("/organizations"),
    /** FR33, public — populates the fan-facing browse filters' country/confederation/organization options. */
    listPublic: () => client.get<ListPublicOrganizationsResponse>("/organizations/public", undefined, { auth: false }),
    get: (organizationId: string) => client.get<OrganizationResponse>(`/organizations/${organizationId}`),
    /** Onboarding (FR1): creates the Organization, seeds its default roles, and creates+assigns its first admin, all in one call. */
    create: (input: CreateOrganizationInput) => client.post<CreateOrganizationResponse>("/organizations", input),
    update: (organizationId: string, input: UpdateOrganizationInput) =>
      client.patch<OrganizationResponse>(`/organizations/${organizationId}`, input),
  };
}

export type OrganizationsApi = ReturnType<typeof createOrganizationsApi>;
