import { createApiClient, type ApiClientConfig } from "./client";
import { createAuditLogApi } from "./audit-log";
import { createAuthApi } from "./auth";
import { createClubsApi } from "./clubs";
import { createCompetitionsApi } from "./competitions";
import { createFixturesApi } from "./fixtures";
import { createLeagueSystemsApi } from "./league-systems";
import { createMatchEventsApi } from "./match-events";
import { createModerationApi } from "./moderation";
import { createOrganizationsApi } from "./organizations";
import { createPlayersApi } from "./players";
import { createRolesApi } from "./roles";
import { createTeamsApi } from "./teams";
import { createVenuesApi } from "./venues";

export * from "./client";
export * from "./audit-log";
export * from "./auth";
export * from "./clubs";
export * from "./competitions";
export * from "./fixtures";
export * from "./league-systems";
export * from "./match-events";
export * from "./moderation";
export * from "./organizations";
export * from "./players";
export * from "./roles";
export * from "./teams";
export * from "./venues";

/**
 * The single entry point frontends use: one client instance per app,
 * configured once with how to read/refresh the access token, exposing a
 * fully-typed method per resource group.
 */
export function createLeagueLiveApiClient(config: ApiClientConfig) {
  const client = createApiClient(config);
  return {
    client,
    auth: createAuthApi(client),
    organizations: createOrganizationsApi(client),
    roles: createRolesApi(client),
    auditLog: createAuditLogApi(client),
    clubs: createClubsApi(client),
    venues: createVenuesApi(client),
    teams: createTeamsApi(client),
    players: createPlayersApi(client),
    competitions: createCompetitionsApi(client),
    leagueSystems: createLeagueSystemsApi(client),
    fixtures: createFixturesApi(client),
    matchEvents: createMatchEventsApi(client),
    moderation: createModerationApi(client),
  };
}

export type LeagueLiveApiClient = ReturnType<typeof createLeagueLiveApiClient>;
