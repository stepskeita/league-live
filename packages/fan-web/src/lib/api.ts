import { createLeagueLiveApiClient } from "@leaguelive/shared";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// No token config: every read this app makes (live scores, browsing,
// standings) is one of the shared client's `auth: false` public endpoints —
// there is no sign-in anywhere in this app.
export const api = createLeagueLiveApiClient({ baseUrl });
