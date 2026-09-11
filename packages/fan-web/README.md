# @leaguelive/fan-web

LeagueLive's public fan-facing web app (Next.js App Router, Turbopack). No sign-in anywhere in this app — every read it makes is one of the shared API client's public (`auth: false`) endpoints.

## Setup

```
cp .env.example .env
npm run dev -w @leaguelive/fan-web   # or: cd packages/fan-web && npm run dev
```

Edit `.env` if the backend isn't reachable at `http://localhost:4000` — see `.env.example`. The backend must be running with Redis available (Socket.io's room broadcast is Redis-backed — see `backend`'s README) for live score updates to actually arrive.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm start` — production build and serve
- `npm run lint` / `npm run typecheck`

## Pages

- **`/` — Live Scores (FR32).** Every in-progress fixture, filterable by Organization/country/category. Initial data comes from `GET /fixtures/live`; ongoing score updates come from Prompt 13's Socket.io channel, not polling — `useFixtureLiveStates` (`src/lib/use-fixture-live-states.ts`) joins each visible fixture's room and merges `FIXTURE_STATE` pushes over the initial snapshot. A fixture whose pushed state moves past `in_progress` (full time, cancelled) drops off this list immediately rather than lingering — this page is specifically "what's live right now," not a results list. A manual "Refresh" button (not a poll) is what picks up a fixture that *starts* after the page loaded, since this client can't join a room for a fixture id it doesn't know about yet.
- **`/fixtures` — Fixtures & Results (FR33).** `GET /fixtures/browse`, filterable by every dimension FR33 names — country, confederation, organization, competition, category, team, and date — plus an All/Upcoming/Results tab (mapped to the `status` filter) so "fixtures and results" reads as one listing distinguished by status, not two separate pages. Paginated (20 per page).

## Backend additions this required

FR32/FR33 are fan-facing, but before this the backend had no public way to browse fixtures beyond the live list, nor any public directory of Organizations/Competitions/Teams to populate filter dropdowns from — every existing read was gated behind an admin permission. Added alongside the frontend, all public (no `authenticate()`), all in `backend`:

- **`GET /fixtures/browse`** (`fixture.service.ts`'s `browseFixtures`) — the FR33 listing itself: paginated, filterable by every dimension FR33 names. None of country/confederation/category/team are fields on `Fixture` — each is resolved to a set of ids first (Organization/Competition/CompetitionEntry), same approach as the pre-existing `listLiveFixtures`.
- **`GET /organizations/public`, `GET /competitions/public`, `GET /teams/public`** — lightweight public directories (`{id, name, country, confederation}` / `{id, organization_id, name, category, season, format}` / `{id, organization_id, name, category}`) that populate `Filters`' dropdowns (`src/lib/use-filter-options.ts`) and are filtered further client side as a viewer narrows their selection.
- **`LiveFixtureSummary` and the new `PublicFixtureSummary`** (`@leaguelive/shared`) both carry resolved organization/competition/team names, not just ids — a fan-facing client has no other authorized way to resolve `home_entry_id`/`away_entry_id`/`competition_id`/`organization_id` to anything renderable. Both share one batched resolver (`resolveFixtureEnrichment` in `fixture.service.ts`) that turns a page of fixtures into one round trip per related collection rather than resolving each fixture one at a time.

## Realtime (Prompt 13)

`src/lib/socket.ts` opens one Socket.io connection for the whole app (lazily, browser only) and exposes `joinFixtureRoom`/`leaveFixtureRoom`/`onFixtureState`/`onMatchEvent` — thin wrappers over the exact client/server event names and payload shapes defined once in `@leaguelive/shared`'s `types/realtime.ts`, shared with the backend's `socket.service.ts`. The server broadcasts bare `LiveMatchState`/`MatchEvent` objects to a fixture's room (not wrapped in `FixtureStateBroadcast`/`MatchEventBroadcast`) — both already carry their own `fixture_id`, which is how one listener, registered once, knows which fixture a given push belongs to. `useFixtureLiveStates` (`src/lib/use-fixture-live-states.ts`) is the one hook every realtime page uses: pass it whichever fixture ids you want live updates for, it manages joining/leaving those rooms as the list changes and returns the latest state per id.

## Design

Plain CSS Modules, no UI/component library, no Tailwind — same "don't add a dependency for this" discipline as `admin`/`reporter-app`. Accent color is a stadium red (`--color-primary`, `src/app/globals.css`), distinct from `admin`'s blue and `reporter-app`'s green. `socket.io-client` is the one new dependency this package needed beyond what a Next.js app already has — the backend's realtime channel is Socket.io specifically (room/adapter semantics via `@socket.io/redis-adapter`), not a plain WebSocket, so the client has to speak the same protocol.

## Known gaps, not fixed here

- **No SSR/indexability pass (FR37).** Both pages are client components that fetch after mount, matching the pattern every other LeagueLive frontend already uses with the shared API client (a browser `fetch` wrapper, not designed for server-side data loading). Making these pages server-rendered and crawlable is a separate pass, not attempted here.
- **No single-fixture detail page.** Both pages are listings; drilling into one fixture (full event timeline, head-to-head, etc.) wasn't asked for and isn't built.
- **The "elapsed minute" shown on a live card is derived client side** from `started_at` (`src/lib/format.ts`'s `formatElapsedMinutes`), not pushed by the server — `LiveMatchState` deliberately has no running-clock field of its own (see its comment in `@leaguelive/shared`).

## Using `@leaguelive/shared`

Every request/response shape and domain type comes from `@leaguelive/shared` (`createLeagueLiveApiClient`, `ApiRequestError`, the realtime event names/types, `PublicFixtureSummary`, `LiveFixtureSummary`, etc.) rather than being redefined locally — `src/lib/api.ts` is a two-line adapter, and `src/lib/socket.ts` reuses the same protocol constants the backend emits against.

See [../../docs/SRS.md](../../docs/SRS.md) for functional requirements.
