# @leaguelive/reporter-app

LeagueLive's on-the-ground reporter app (React Native/Expo, file-based routing via `expo-router`). Lets field reporters sign in and see the fixtures assigned to them (FR24); match-session/event-logging screens build on top of this in a later pass.

## Setup

```
cp .env.example .env
npm run start -w @leaguelive/reporter-app   # or: cd packages/reporter-app && npm start
```

Edit `.env` if the backend isn't reachable at `http://localhost:4000` — see the comments in `.env.example` (Android emulator and physical devices need a different host than "localhost").

## Scripts

- `npm start` — start the Expo dev server
- `npm run android` / `npm run ios` / `npm run web`
- `npm run lint` / `npm run typecheck`

## Structure

- `app/` — screens, file-based routing (`expo-router`)
  - `login.tsx` — public
  - `(app)/` — everything behind auth; `(app)/_layout.tsx` redirects to `/login` when signed out
- `components/` — `Button`, `Screen`, `TextField`, `ErrorBanner`, `FixtureCard` — the whole visual language in one place
- `lib/` — `api.ts` (the shared API client, configured with this app's token storage), `auth-context.tsx` (React auth state), `token-store.ts` (`expo-secure-store`-backed token persistence)
- `constants/theme.ts` — colors, spacing, radius

## Design

Same visual simplicity as KEKE Ride's driver app — big tap targets (52pt minimum, matching KEKE's `AppButton`), rounded-xl corners, a soft colored shadow on the primary action, minimal chrome (no headers, no tab bars, no nested navigation beyond login → home). Built with plain `StyleSheet` rather than pulling in NativeWind (as KEKE's app does) — a fresh scaffold with two screens doesn't need Tailwind's build setup to hit the same visual result; `constants/theme.ts` is the single place the actual design tokens live. The accent color is LeagueLive's own green, not KEKE's orange, so the two unrelated apps don't look like the same product.

## Auth (Prompt 3's backend)

Email/password against `POST /auth/login`. Tokens persist in `expo-secure-store`; the access token is attached to every authenticated request, and a 401 triggers exactly one `POST /auth/refresh` + retry (built into the shared API client, not reimplemented here) before falling back to a real logout. `AuthProvider` (`lib/auth-context.tsx`) restores a session on launch by loading persisted tokens and calling `GET /auth/me`.

## Home screen (FR24)

Lists `GET /fixtures/mine` — fixtures assigned to the signed-in reporter, and only those; the endpoint itself has no permission gate beyond being authenticated, since a Reporter naturally only has authority over what's assigned to them. Pull-to-refresh, empty state, and an error banner if the request fails.

**Known gap, not fixed here:** fixture cards show date/time/status/score — not team names. `GET /fixtures/mine` returns `home_entry_id`/`away_entry_id`/`competition_id` as bare ids; there's currently no endpoint a plain `match.report` holder (as opposed to `roster.manage`/`competition.manage`) can call to resolve those to human-readable team/competition names. This is a real, cross-cutting gap (the same problem would hit any public "live scores" fan surface too), not something specific to this app — worth a small follow-up endpoint (e.g. a batched "fixture display info" read, or opening a narrow public read on Team/Competition names) rather than working around it here.

## Using `@leaguelive/shared`

Every request/response shape comes from `@leaguelive/shared`'s new `api/` module (`createLeagueLiveApiClient`, `ApiRequestError`, plus the existing domain types like `Fixture`) rather than being redefined locally — `lib/api.ts` is a ~15 line adapter that wires the shared client to this app's token storage, nothing more. That client is deliberately dependency-free (just the global `fetch`, no `URL`/`URLSearchParams`, both unreliable across RN engines) so `admin`, `fan-web`, and `fan-app` can adopt the exact same client later instead of each writing their own fetch wrapper.

See [../../docs/SRS.md](../../docs/SRS.md) for functional requirements.
