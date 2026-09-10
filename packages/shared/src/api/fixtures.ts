import type { Fixture, FixtureContext, FixtureStatus } from "../types/fixture";
import type { LiveFixtureSummary, LiveMatchState } from "../types/live-match-state";
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

export interface ListLiveFixturesResponse {
  fixtures: LiveFixtureSummary[];
}

export interface CreateFixtureInput {
  competition_id: string;
  home_entry_id: string;
  away_entry_id: string;
  venue_id?: string | null;
  /** ISO date string. */
  datetime: string;
  status?: FixtureStatus;
}

export interface UpdateFixtureInput {
  home_entry_id?: string;
  away_entry_id?: string;
  venue_id?: string | null;
  datetime?: string;
  status?: FixtureStatus;
}

export function createFixturesApi(client: ApiClient) {
  return {
    // --- FR18, fixture.manage gated ---
    list: (competitionId?: string) => client.get<ListFixturesResponse>("/fixtures", { competition_id: competitionId }),
    get: (fixtureId: string) => client.get<FixtureResponse>(`/fixtures/${fixtureId}`),
    create: (input: CreateFixtureInput) => client.post<FixtureResponse>("/fixtures", input),
    update: (fixtureId: string, input: UpdateFixtureInput) => client.patch<FixtureResponse>(`/fixtures/${fixtureId}`, input),
    delete: (fixtureId: string) => client.delete<void>(`/fixtures/${fixtureId}`),

    // --- FR19, reporter.assign gated — a separate permission from fixture.manage ---
    assignReporter: (fixtureId: string, userId: string) =>
      client.put<FixtureResponse>(`/fixtures/${fixtureId}/reporter`, { user_id: userId }),
    unassignReporter: (fixtureId: string) => client.delete<FixtureResponse>(`/fixtures/${fixtureId}/reporter`),

    // --- FR24, a Reporter's own app ---
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

    // --- FR30/FR32, public — no token required ---
    getLiveState: (fixtureId: string) =>
      client.get<LiveMatchStateResponse>(`/fixtures/${fixtureId}/live`, undefined, { auth: false }),
    listLive: (query: { organization_id?: string; country?: string; category?: string } = {}) =>
      client.get<ListLiveFixturesResponse>("/fixtures/live", query, { auth: false }),
  };
}

export type FixturesApi = ReturnType<typeof createFixturesApi>;
