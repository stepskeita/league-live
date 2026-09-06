import { createApiClient, type ApiClientConfig } from "./client";
import { createAuthApi } from "./auth";
import { createFixturesApi } from "./fixtures";

export * from "./client";
export * from "./auth";
export * from "./fixtures";

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
    fixtures: createFixturesApi(client),
  };
}

export type LeagueLiveApiClient = ReturnType<typeof createLeagueLiveApiClient>;
