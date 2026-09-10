import type { Location } from "../types/common";
import type { Venue } from "../types/venue";
import type { ApiClient } from "./client";

export interface VenueResponse {
  venue: Venue;
}

export interface ListVenuesResponse {
  venues: Venue[];
}

export interface CreateVenueInput {
  name: string;
  location: Location;
  organization_id?: string;
}

export interface UpdateVenueInput {
  name?: string;
  location?: Location;
}

/** FR16, roster.manage gated. */
export function createVenuesApi(client: ApiClient) {
  return {
    list: () => client.get<ListVenuesResponse>("/venues"),
    get: (venueId: string) => client.get<VenueResponse>(`/venues/${venueId}`),
    create: (input: CreateVenueInput) => client.post<VenueResponse>("/venues", input),
    update: (venueId: string, input: UpdateVenueInput) => client.patch<VenueResponse>(`/venues/${venueId}`, input),
    delete: (venueId: string) => client.delete<void>(`/venues/${venueId}`),
  };
}

export type VenuesApi = ReturnType<typeof createVenuesApi>;
