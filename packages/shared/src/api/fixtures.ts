import type { Fixture } from "../types/fixture";
import type { LiveMatchState } from "../types/live-match-state";
import type { ApiClient } from "./client";

export interface ListFixturesResponse {
  fixtures: Fixture[];
}

export interface FixtureResponse {
  fixture: Fixture;
}

export interface LiveMatchStateResponse {
  liveMatchState: LiveMatchState;
}

// Only the reads a Reporter's own app needs (FR24) — the admin-facing
// fixture.manage CRUD isn't something this client has a consumer for yet.
// Add to this module, following the same pattern, when one does.
export function createFixturesApi(client: ApiClient) {
  return {
    /** FR24: fixtures assigned to the current authenticated Reporter. */
    listMine: () => client.get<ListFixturesResponse>("/fixtures/mine"),
    /** FR30/FR32, public — no token required. */
    getLiveState: (fixtureId: string) =>
      client.get<LiveMatchStateResponse>(`/fixtures/${fixtureId}/live`, undefined, { auth: false }),
  };
}

export type FixturesApi = ReturnType<typeof createFixturesApi>;
