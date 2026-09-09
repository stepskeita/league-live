# @leaguelive/reporter-app

LeagueLive's on-the-ground reporter app (React Native/Expo, file-based routing via `expo-router`). Lets a field reporter sign in, see the fixtures assigned to them (FR24), run a match session (start, log goal/card/substitution/half time/full time, end — FR25-FR27) — offline-first, queuing locally and syncing automatically — and hand off to post-match confirmation (FR28).

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
    - `index.tsx` — home, the fixtures list
    - `fixtures/[fixtureId]/` — its own `_layout.tsx` re-enabling a minimal native header (a real back gesture earns its keep here, unlike login/home which have nowhere to go back to)
      - `index.tsx` — the match session screen
      - `confirm.tsx` — post-match confirmation
- `components/` — `Button`, `Screen`, `TextField`, `ErrorBanner`, `FixtureCard` (auth/home) plus `ActionTile`, `SegmentedToggle`, `MinuteStepper`, `EventLogModal`, `EventListItem`, `SyncStatusBar` (match session) — the whole visual language in one place
- `lib/` — `api.ts` (the shared API client, configured with this app's token storage), `auth-context.tsx` (auth state + effective permissions), `fixtures-context.tsx` (the fetched-once "my fixtures" list every screen reads from), `event-queue.ts` (the offline write queue's storage + sync engine, no React), `event-queue-context.tsx` (the React layer: connectivity, `EventQueueProvider`), `match-session.ts` (pure helpers: score computation, elapsed-minute default, client event id generation, merging server + queued events for display), `token-store.ts` (`expo-secure-store`-backed token persistence)
- `constants/theme.ts` — colors, spacing, radius

## Design

Same visual simplicity as KEKE Ride's driver app — big tap targets (52pt minimum, matching KEKE's `AppButton`), rounded-xl corners, a soft colored shadow on the primary action, minimal chrome. Built with plain `StyleSheet` rather than pulling in NativeWind (as KEKE's app does) — `constants/theme.ts` is the single place the actual design tokens live. The accent color is LeagueLive's own green, not KEKE's orange, so the two unrelated apps don't look like the same product. The event-logging tiles use plain emoji (⚽ 🟨 🔄 ⏸ 🏁) rather than an icon library — no new dependency, renders natively everywhere.

## Auth (Prompt 3's backend)

Email/password against `POST /auth/login`. Tokens persist in `expo-secure-store`; the access token is attached to every authenticated request, and a 401 triggers exactly one `POST /auth/refresh` + retry (built into the shared API client, not reimplemented here) before falling back to a real logout. `AuthProvider` (`lib/auth-context.tsx`) restores a session on launch (`GET /auth/me`) and also fetches `GET /auth/me/permissions`, exposing `hasPermission()` — the confirm screen uses this, see below.

## Home screen (FR24)

Lists `GET /fixtures/mine` via `FixturesProvider` (`lib/fixtures-context.tsx`) — fixtures assigned to the signed-in reporter, and only those. Pull-to-refresh, empty state, error banner. Fetched once and shared: the match session and confirm screens read the same fixture by id from this context (`getById`) rather than re-fetching — there's no `GET /fixtures/:id` a plain Reporter can call anyway (that route is `fixture.manage` gated), so this cache is the only way those screens have a Fixture to work with at all. After start/end/confirm, the backend's updated Fixture is pushed back in (`updateFixture`) so every screen — including this list — stays in sync without a full refetch.

## Match session screen (FR25-FR27)

`app/(app)/fixtures/[fixtureId]/index.tsx`. Renders differently by `fixture.status`:

- **`scheduled`** — a single "Start Match" button (`POST /fixtures/:id/start`).
- **`in_progress`** — a live score header, a 2×3 grid of large tiles (Goal, Card, Substitution, Half Time, Full Time — big tap targets, not a dropdown/picker), the event history so far, and "End Match" (confirmed via a native `Alert`, then `POST /fixtures/:id/end`).
- **`completed`** — the final tally, event history, and a button through to confirmation.
- **`cancelled`** — a plain message; nothing to log.

**Minimal required fields, concretely:**
- Goal/Card/Substitution open one shared bottom-sheet form (`EventLogModal`): a team toggle (required), a minute stepper pre-filled with the match's actual elapsed time (tap to confirm rather than type, adjustable via +/−), and — card only — a yellow/red toggle. Nothing else; there's no player picker (see the gap noted below).
- Half Time/Full Time skip the form entirely — one tap, a native confirm showing the auto-computed minute, done. `team_id` is technically required by the backend schema even for these whole-match events; the app defaults it to the home team silently rather than asking the reporter to pick a team for something that isn't about either team. Each is disabled ("Logged") once already used once.

Every log action — the modal's submit, and the Half Time/Full Time quick-confirm — calls `enqueue()`, not the backend directly. See Offline write queue below for what that actually does.

## Offline write queue (FR27)

`lib/event-queue.ts` + `lib/event-queue-context.tsx`. The point of "offline-first" here is specific: an event is written to local storage and shown as pending *before* any network call happens, not "network call, and only fall back to local storage if that fails."

- **Storage: `@react-native-async-storage/async-storage`, not `expo-secure-store`.** SecureStore is backed by the OS keychain, which has strict per-item size limits (a few KB on iOS) — fine for the couple of auth tokens it holds (`token-store.ts`), wrong for a queue that grows by one entry per goal/card/substitution/half-time/full-time over the course of a match, which can exceed that. AsyncStorage has no such limit. SecureStore stays exactly where it was for the auth token (Prompt 16) — this only concerns where *queued events* live.
- **`enqueueEvent()`** persists the entry (`status: "pending"`) to AsyncStorage before it resolves, notifies subscribers (so the UI updates instantly), and *then* fires a sync attempt in the background — it does not await it. A form's `onSubmit`/`onPress` handler returns as soon as the write to disk completes, never once it reaches the server.
- **`syncQueue()`** walks pending entries in order, submitting each via `api.matchEvents.create()` — idempotent on `client_event_id` (Prompt 12), so a retry of an entry that actually landed on a previous attempt just comes back as the same event, never a duplicate. A rejection is classified: a 4xx (bad data, permission, the fixture's result already locked) marks that one entry `"failed"` and moves to the next; anything else — no network, a 5xx — leaves the entry `"pending"` and stops the whole pass immediately, since every remaining entry would fail identically for the same reason. `"failed"` entries are *not* auto-retried (blindly resubmitting a rejected request wouldn't fix it) — `retryEntry()` resets one back to `"pending"` and re-triggers a sync, invoked from a "Retry" tap in the UI.
- **What triggers a sync attempt:** after every `enqueueEvent()`; a `@react-native-community/netinfo` listener when connectivity is reestablished; the app returning to the foreground (`AppState`); and a 20s fallback interval, since NetInfo's reachability check is known to be imperfect on some networks (e.g. connected to Wi-Fi with no real internet) — belt and suspenders, not the primary trigger.
- **Survives the app closing.** The queue is loaded from AsyncStorage on `EventQueueProvider` mount and picks up exactly where it left off — nothing here depends on the app process staying alive between when an event is logged and when it actually syncs.
- **Display.** `mergeEventsForDisplay()` (`lib/match-session.ts`) combines the server's confirmed events (`GET /fixtures/:id/events`) with this device's queue for the fixture into one de-duplicated, minute-sorted list, keyed by `client_event_id` so an item's identity is stable across its own pending → synced transition (no key-changing re-render/flicker). The score header counts pending and synced goals (excludes failed) — a goal you just tapped shows up in the score immediately, not once a request round-trips.
- **Surfacing status, concretely:** `SyncStatusBar` is the ambient, screen-level indicator — 📴 offline with a queued count, 🔄 syncing, or ⚠️ N failed; renders nothing once everything's synced and online, so it doesn't compete with the tap targets below it in the common case. `EventListItem` is the per-event indicator — quiet for `"synced"`, a small "Pending" badge, or a "Failed" badge with a one-tap "Retry" right on the row.
- **What this doesn't do:** classify server rejections beyond "4xx vs. everything else," or let the reporter edit/delete a queued event before it syncs (correcting a *synced* event is FR39's job, already built, gated behind `results.verify` on the backend).

## Post-match confirmation screen (FR28)

`app/(app)/fixtures/[fixtureId]/confirm.tsx`. Shows the score and the full event list for review, then:

- If the result is already locked (`fixture.result_locked_at`), a read-only "confirmed" state showing the *official* score (`fixture.home_score`/`away_score` — not recomputed locally, since once locked that's the source of truth).
- Otherwise, **the confirm action only appears if `hasPermission("results.verify")`.** The backend gates `POST /fixtures/:id/confirm` behind `results.verify`, a *different* permission from `match.report` (the default Reporter role holds only the latter) — see the backend README's Match reporting section for why. A plain Reporter sees the same review screen but an informational note instead of a button; anyone (Reporter, verifier, admin) who holds `results.verify` can actually confirm.
- **If this device still has pending or failed queue entries for this fixture, a warning banner says so before the confirm button** — the backend computes the official score from confirmed `MatchEvent`s only, so confirming while something on this device hasn't synced yet would lock a result that's missing it. This is a warning, not a hard block: the backend has no way to know about another device's local queue at all, so refusing to let *this* screen confirm wouldn't be correct in general — it's surfaced information, and the reporter's (or verifier's) call.

## Known gap, not fixed here

The home screen's fixture cards still show date/time/status/score, not team names — resolving that for every fixture in the list would mean one `GET /fixtures/:id/context` call per card, which isn't worth it for a list. The session and confirm screens *do* resolve real team names, via the new `GET /fixtures/:fixtureId/context` endpoint (backend README, Fixtures section) added in this pass specifically because building a "log a goal, pick a team" form is impossible without it — `team_id` is required and there was previously no authorized way for a plain `match.report` holder to learn either team's identity at all. There's still no player roster access, which is why events don't have a player picker (the same root cause: `Player`/`RosterEntry` reads are `roster.manage` gated).

## Using `@leaguelive/shared`

Every request/response shape comes from `@leaguelive/shared`'s `api/` module (`createLeagueLiveApiClient`, `ApiRequestError`, plus the domain types like `Fixture`, `MatchEvent`, `FixtureContext`) rather than being redefined locally — `lib/api.ts` is a small adapter wiring the shared client to this app's token storage, nothing more. That client is deliberately dependency-free (just the global `fetch`, no `URL`/`URLSearchParams`, both unreliable across RN engines) so `admin`, `fan-web`, and `fan-app` can adopt the exact same client later instead of each writing their own fetch wrapper.

See [../../docs/SRS.md](../../docs/SRS.md) for functional requirements.
