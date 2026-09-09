import type { Fixture, FixtureContext } from "../types/fixture";
import type { LiveMatchState } from "../types/live-match-state";
import type { ApiClient } from "./client";

export interface ListFixturesResponse {
  fixtures: Fixture[];
}

export interface FixtureResponse {
  fixture: Fixture;
}

export interface FixtureContextResponse {
  fixtureContext: FixtureContext;
}

export interface LiveMatchStateResponse {
  liveMatchState: LiveMatchState;
}

// Reads/actions a Reporter's own app needs (FR24-FR28) — the admin-facing
// fixture.manage CRUD isn't something this client has a consumer for yet.
// Add to this module, following the same pattern, when one does.
export function createFixturesApi(client: ApiClient) {
  return {
    /** FR24: fixtures assigned to the current authenticated Reporter. */
    listMine: () => client.get<ListFixturesResponse>("/fixtures/mine"),
    /** The two teams' {id, name} — see fixture.service.ts's getFixtureContext for why this exists. */
    getContext: (fixtureId: string) => client.get<FixtureContextResponse>(`/fixtures/${fixtureId}/context`),
    /** FR25: idempotent — safe to call again on an already-started session. */
    start: (fixtureId: string) => client.post<FixtureResponse>(`/fixtures/${fixtureId}/start`),
    /** FR25: idempotent, same as start. Does not itself lock the result — see confirm. */
    end: (fixtureId: string) => client.post<FixtureResponse>(`/fixtures/${fixtureId}/end`),
    /** FR28: results.verify gated on the backend — the caller must check its own permissions before showing this action. */
    confirm: (fixtureId: string) => client.post<FixtureResponse>(`/fixtures/${fixtureId}/confirm`),
    /** FR30/FR32, public — no token required. */
    getLiveState: (fixtureId: string) =>
      client.get<LiveMatchStateResponse>(`/fixtures/${fixtureId}/live`, undefined, { auth: false }),
  };
}

export type FixturesApi = ReturnType<typeof createFixturesApi>;
