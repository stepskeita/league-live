# @leaguelive/backend

LeagueLive's backend API. Serves data and real-time updates to `admin`, `fan-web`, and `reporter-app`.

## Setup

Copy `.env.example` to `.env` and adjust as needed (defaults point at a local MongoDB and Redis):

```
cp .env.example .env
```

## Scripts

- `npm run dev` — start in watch mode (`ts-node-dev`)
- `npm run build` — compile to `dist/`
- `npm start` — run the compiled build
- `npm run lint` / `npm run typecheck`
- `npm run test` — runs `*.test.ts` files under `src/` with Node's built-in test runner (`node --test`, via `ts-node/register`) — no separate test framework dependency. `npm run build` compiles from `tsconfig.build.json`, which excludes test files from `dist/`; `npm run typecheck` still covers them via the base `tsconfig.json`.
- `npm run seed:platform-operator` — creates one Platform Operator account and grants it the Platform Operator role (idempotent; see below)
- `npm run seed:default-roles` — backfills the Organization Admin / Reporter default roles for every existing Organization (idempotent; see below)

## Structure

- `src/routes` — Express routers, mounted in `src/app.ts`
- `src/controllers` — request handlers
- `src/services` — business logic and external connections (Mongo, Redis, auth/token services)
- `src/models` — Mongoose schemas/models
- `src/middleware` — Express middleware (error handling, auth, etc.)
- `src/config` — typed environment config (`src/config/env.ts`)
- `src/scripts` — one-off scripts run via ts-node (e.g. seeding)

## Health check

`GET /health` reports process uptime and the live status of the Mongo and Redis connections.

## Auth

JWT-based: a short-lived access token (`JWT_ACCESS_TTL`, default 15m) authenticates requests via `Authorization: Bearer <token>`, and a longer-lived refresh token (`JWT_REFRESH_TTL`, default 30d) is exchanged for a new pair at `/auth/refresh`. Refresh tokens are tracked in Redis by their `jti` so they can be revoked (`/auth/logout`) and are rotated (single-use) on every refresh.

- `POST /auth/signup` — `{ name, email, password, phone?, organization_id? }`. Omit `organization_id` for a platform-level account.
- `POST /auth/login` — `{ email, password }`
- `POST /auth/refresh` — `{ refreshToken }` → new `{ accessToken, refreshToken }`
- `POST /auth/logout` — `{ refreshToken }` → revokes it
- `GET /auth/me` — requires `Authorization: Bearer <accessToken>`
- `GET /auth/me/permissions` — the caller's own effective permissions (FR7/FR8): `{ permissions: PermissionKey[] }`. No specific permission required beyond being authenticated — this is what the admin panel calls on session load to drive its sidebar and page guards (FR9/NFR10); it's not itself the enforcement, the backend route guards are.

This covers auth mechanics only — issuing and verifying identity. Permission checking (below) is what decides what an authenticated user is allowed to do.

### Seeding the Platform Operator

`npm run seed:platform-operator` creates one `User` with `organization_id: null` (a Platform Operator is, by definition, not scoped to an Organization — see [../../docs/SRS.md](../../docs/SRS.md) §2 and §7) using `PLATFORM_OPERATOR_EMAIL` / `_NAME` / `_PASSWORD` from the environment, and grants it the platform scoped "Platform Operator" role (see below). It's idempotent. It refuses to run with the default password when `NODE_ENV=production`.

## Permissions & roles

Permissions (FR4) are a **fixed, code defined catalog** — see `PERMISSIONS` in `packages/shared/src/types/permission.ts` — never a database collection a user can edit. There's no CRUD for permissions; a new one only exists once a developer adds it here alongside the check it guards.

Each permission also carries a `scope`: `"organization"` (grantable within one Organization) or `"platform"` (only meaningful platform-wide — currently just `organization.manage`, FR1's onboard/list/manage-any-Organization capability). This matters for seeding: "Organization Admin (all permissions)" (FR6) means all *organization scoped* permissions, not literally the whole catalog — `ORGANIZATION_PERMISSION_KEYS` in `role.service.ts` filters by scope for exactly this reason. Folding a platform scoped permission into an Organization's own default admin role would make every Organization Admin an incidental Platform Operator.

Roles (FR5/FR6) are dynamic, organization scoped documents that hold any combination of permission keys from the catalog. A `Role.organization_id` of `null` means the role is platform scoped (applies across every Organization) rather than tied to one, which is how the Platform Operator's elevated access works — as an ordinary role holding every permission (both scopes), not a hardcoded role-name check anywhere (NFR5).

A user's **effective permissions** (FR7) are the union of every permission on every `UserRole` (a user ↔ role assignment) they hold — resolved by `getEffectivePermissions()` in `src/services/permission.service.ts`.

- `POST /roles` — `{ name, permission_keys, organization_id? }`. `organization_id` only matters for a Platform Operator caller (creating a role for a specific Organization, or omitting it for a platform scoped role) — an org-scoped caller's own Organization is always used, ignoring anything else in the body.
- `GET /roles` / `GET /roles/:roleId`
- `PATCH /roles/:roleId` — `{ name?, permission_keys? }`
- `DELETE /roles/:roleId`
- `POST /roles/:roleId/assignments` — `{ user_id }`, assigns the role
- `GET /roles/:roleId/assignments` — users holding the role
- `DELETE /roles/:roleId/assignments/:userId` — unassigns it

All of the above require `role.manage`, checked by `requirePermission()` in `src/middleware/require-permission.ts`, which runs after `authenticate()` and resolves + caches the caller's effective permissions on `req.user.permissions` for the rest of the request.

**Enforcement doesn't stop at the route handler.** Every query in `role.service.ts` is built by merging in `organizationScopeFilter()` (`src/utils/tenant-scope.ts`), not by trusting an `:id` path param alone — so even if a route's permission check were ever missing or wrong, an org-scoped caller still cannot read or mutate another Organization's roles by guessing an id. A `null` `organization_id` (Platform Operator) adds no filter, matching "not organization scoped." Any collection added later that belongs to an Organization should follow the same pattern.

### Seeding default roles

`npm run seed:default-roles` backfills the two FR6 default roles — **Organization Admin** (every organization scoped permission) and **Reporter** (`match.report` only) — for any Organization that doesn't have them yet, e.g. one created directly in the database rather than through `POST /organizations`. `seedDefaultRolesForOrganization()` in `role.service.ts` is the same function the onboarding endpoint below calls directly at creation time; both paths are idempotent and never overwrite a role's permissions if it already exists (so an Organization's own customization of its default roles is never clobbered by re-seeding).

## Organization onboarding

`POST /organizations` (FR1) is one call doing three things: create the Organization, seed its two default roles (`seedDefaultRolesForOrganization()`, above), and create + assign its first **Organization Admin** user (`ensureRoleAssignment()`, the same idempotent-assignment helper the Platform Operator seed script uses to bootstrap itself). Without that last step nobody in the new Organization would hold `role.manage`, and no further role assignment could ever happen there.

```
POST /organizations
{
  "name": "...", "type": "federation" | "confederation" | "league_operator" | "competition_organizer",
  "country": "...", "confederation": "...",       // optional
  "contact": { "email": "...", "phone": "..." },  // Organization's own contact
  "admin": { "name": "...", "email": "...", "phone": "...", "password": "..." }  // its first user
}
→ 201 { organization, adminUser }
```

- `GET /organizations` / `GET /organizations/:organizationId`
- `PATCH /organizations/:organizationId` — `{ name?, type?, country?, confederation?, contact? }`

All four require `organization.manage` — a **platform scoped** permission (see above), so it's never in an Organization's own default roles; in practice only the Platform Operator role holds it. No delete/deactivate route exists yet — an Organization has too much cascading data (Clubs, Teams, Users, Roles, ...) hanging off its id for that to be a safe default without a real soft-delete design, which wasn't asked for here.

Not wrapped in a transaction (same tradeoff as `deleteRole`'s cascading delete): if admin-account creation fails after the Organization and its default roles already exist, the Organization is left admin-less but intact and recoverable — assign an existing or new user to its Organization Admin role through the normal `/roles/:roleId/assignments` endpoint.

## Rosters: Clubs, Teams, Venues, Players

FR16/FR20, all gated behind **`roster.manage`** (an organization scoped permission — every Organization Admin has it by default). Standard CRUD, same `organizationScopeFilter()` / `resolveOrganizationScopeForCreate()` pattern as everything else: an org-scoped caller only ever sees or creates records in their own Organization; a Platform Operator must specify `organization_id` to create one (there's no "platform scoped" Club/Team/Venue/Player — every one of these always belongs to exactly one Organization).

- `POST/GET /clubs`, `GET/PATCH/DELETE /clubs/:clubId` — `{ name }`. Deleting a Club that still has Teams referencing it is rejected (409) rather than cascading — a Club's Teams have independent value (their own roster, fixtures) that shouldn't disappear because the Club record did.
- `POST/GET /venues`, `GET/PATCH/DELETE /venues/:venueId` — `{ name, location: { address?, city?, country? } }`. Same 409-if-referenced rule for Teams that have it as their home venue.
- `POST/GET /teams`, `GET/PATCH/DELETE /teams/:teamId` — `{ name, club_id, category, venue_id? }`. `club_id` (and `venue_id`, if given) must reference a Club/Venue that exists **in the same Organization** — checked at the query layer in `team.service.ts`, not left to a bare id lookup. Deleting a Team cascades its roster entries (below) — those don't have independent value once the Team is gone, same as `deleteRole` cascading its `UserRole` assignments — but is rejected (409) if the Team is still entered in a Competition (see below), same "block, don't cascade" rule as Club/Venue.
- `POST/GET /players`, `GET/PATCH/DELETE /players/:playerId` — `{ name, position, date_of_birth }`. A Player is a **person record**, not tied to one fixed team (see below) — deleting one cascades their roster entries the same way deleting a Team does.

### Player rosters, per season (FR20)

A player's roster membership is tracked separately from the player record itself, via `RosterEntry` (`team_id` + `player_id` + `season`), because FR20 asks for rosters "per team per season" — the same person can be on different teams' rosters in different seasons, which a single fixed `Player.team_id` field couldn't represent. (The original data-model pass gave `Player` a `team_id` field; this task removed it once building the roster endpoints on top of it exposed that it couldn't actually satisfy FR20 — nothing else depended on it yet.) `season` is a free-form trimmed string (e.g. `"2024/2025"`), matching how `Competition.season` is modeled in `docs/SRS.md` section 7 — there's no separate Season entity.

- `GET /teams/:teamId/roster` — optional `?season=` filter, newest season first
- `POST /teams/:teamId/roster` — `{ player_id, season }`. `player_id` must belong to the same Organization as the team. A `(team_id, player_id, season)` unique index blocks duplicate entries (409).
- `DELETE /teams/:teamId/roster/:entryId`

## Competitions (FR13-FR17)

Gated behind **`competition.manage`** (organization scoped — every Organization Admin has it by default).

- `POST/GET /competitions`, `GET/PATCH/DELETE /competitions/:competitionId` — `{ name, category, format: { type, config? }, ruleset?, season }`
  - `category` is free-form, Organization-defined text (FR13), same as `Team.category` — not a fixed enum.
  - `format.type` (FR14) is one of `COMPETITION_FORMATS` = `"league" | "knockout" | "group_and_knockout"`; `format.config` is deliberately unstructured (format-specific settings), defaulting to `{}`.
  - `ruleset` (FR15: "configurable per competition, not hardcoded") is also unstructured — points-per-result, tiebreaker order, whatever the caller wants — with a sensible default (`{ points: { win: 3, draw: 1, loss: 0 }, tiebreakers: [...] }`) so callers aren't forced to specify one from scratch. Both `format.config` and `ruleset` are validated only as "must be a plain object," never their internal shape, per FR15.
  - Deleting a Competition cascades its entries and Fixtures (below) — neither has independent value once the Competition is gone.

### Competition entries (FR17)

`CompetitionEntry` joins a Competition to a Team. `organization_id` on the join record is the **Competition's** owning Organization (the side managing entries), not necessarily the Team's — a competition can draw in teams from other Organizations on the platform, so unlike every other cross-reference in this codebase (`Team.club_id`, `RosterEntry.player_id`, ...) the Team lookup here is **deliberately not scoped** to the requesting user's Organization. `getCompetition()`'s scoped fetch is what still stops a caller from managing entries on a competition outside their access — only the Team side is intentionally open platform-wide.

- `GET/POST /competitions/:competitionId/entries` — `{ team_id }`. A `(competition_id, team_id)` unique index blocks duplicate entries (409).
- `DELETE /competitions/:competitionId/entries/:entryId` — rejected (409) if a Fixture still references this entry as its home or away side.

## Fixtures (FR18/FR19/FR24)

Unlike every other resource router, permissions differ **by route** here, so `requirePermission()` is applied per-route instead of once via `router.use()`:

- `POST/GET /fixtures`, `GET/PATCH/DELETE /fixtures/:fixtureId` — gated behind **`fixture.manage`**. `{ competition_id, home_entry_id, away_entry_id, venue_id?, datetime, status? }`. `home_entry_id`/`away_entry_id` (docs/SRS.md section 7's "home entry, away entry") reference `CompetitionEntry`, not `Team` directly, and both must belong to the given `competition_id` — checked via `resolveEntryForCompetition()` in `fixture.service.ts`, not a bare id lookup. `venue_id`, if given, must belong to the competition's own Organization (`resolveVenueInOrganization()`, shared with `team.service.ts`). `status` defaults to `"scheduled"`; it and the `home_score`/`away_score`/`result_locked_at`/`started_at`/`ended_at` fields below are **not** editable through this general `PATCH` — they only change through the dedicated match-reporting actions below, never as a direct field write.
- `PUT /fixtures/:fixtureId/reporter` — `{ user_id }`, `DELETE /fixtures/:fixtureId/reporter` — gated behind **`reporter.assign`** (FR19), a *separate* permission from `fixture.manage`. Assigning a reporter does not go through the general `PATCH` — it's its own action so a role can hold one permission without the other (e.g. someone who schedules fixtures but shouldn't decide who reports on them, or vice versa). The assigned user must belong to the fixture's Organization; nothing checks they hold any particular role or permission themselves (NFR5 — no hardcoded role-name check, and assignment shouldn't have to happen in a specific order relative to granting `match.report`).
- `GET /fixtures/mine` — FR24: a Reporter sees only fixtures assigned to them. Requires only `authenticate()`, no specific permission — registered before `/:fixtureId` so Express doesn't match `"mine"` as an id.

## Match reporting (FR25-FR28)

Four separate capabilities, four separate gates — this is the router where that matters most:

- `POST /fixtures/:fixtureId/start`, `POST /fixtures/:fixtureId/end` — gated behind **`match.report`** (FR25). `start` moves `status` `"scheduled"` → `"in_progress"` and sets `started_at`; `end` moves `"in_progress"` → `"completed"` and sets `ended_at`. Both are idempotent — calling `start` when already `"in_progress"` (or `end` when already `"completed"`) is a no-op returning the current fixture, not an error, since FR27's "queues and retries" concern isn't unique to event submission.
- `GET/POST /fixtures/:fixtureId/events` — gated behind **`match.report`** (FR26). `{ client_event_id, type, minute, team_id, player_id?, details? }`, `type` one of `MATCH_EVENT_TYPES` = `"goal" | "card" | "substitution" | "half_time" | "full_time"`. `team_id` must be one of the fixture's two teams (resolved via its `CompetitionEntry`s); `details` is unstructured (card color, substitute player id, whatever — same reasoning as `Competition.ruleset`). Rejected once the fixture's result is locked (below), or if the session hasn't started (`status` is `"scheduled"` or `"cancelled"`).
  - **Idempotent on `client_event_id` (FR27).** The reporter app generates this id client-side before submission and retries on reconnect, so `createMatchEvent()` treats a resubmission as a no-op: it looks up `(fixture_id, client_event_id)` first and returns the existing event (`200`) rather than erroring or creating a duplicate (a genuinely new event returns `201`). A `(fixture_id, client_event_id)` unique index is the backstop for the concurrent-retry race — a duplicate-key hit re-fetches and returns the winner rather than surfacing as an error.
- **Authorization for all three of the above is not `fixture.manage`'s organization scoping** — it's `requireAssignedReporter()` in `fixture.service.ts`: the caller must literally be `fixture.reporter_user_id`. `match.report` at the route level just gets you in the door (do you have the capability at all); the data-layer check is what actually stops one Organization's other `match.report` holders from starting sessions or logging events on a fixture that isn't theirs — even an Organization Admin, who'd need to assign themself as the reporter first (via the existing `reporter.assign`-gated endpoint) rather than getting an implicit override. `GET /fixtures/:fixtureId/events` uses the same check.
- `POST /fixtures/:fixtureId/confirm` — gated behind **`results.verify`** (FR28), *not* `match.report` — the reporter who covered the match and whoever confirms the official result don't have to be the same person, and this uses the normal organization-scoped `getFixture()`, not the assigned-reporter check. Requires `status === "completed"` (session must have ended) and rejects if already locked (409). Computes `home_score`/`away_score` by counting `"goal"` `MatchEvent`s per side, then sets `result_locked_at` — after which no more events can be logged for this fixture. FR39 (reviewing/correcting events *before* confirmation) isn't built here; this task only locks the result once someone with `results.verify` decides it's ready.

Every mutation above that changes what a fan would see live (session start/end, a new event, result confirmation) also refreshes and broadcasts live match state — see Realtime below.

## Realtime: live scores (FR29/FR30)

Socket.io, with `@socket.io/redis-adapter` as the pub/sub adapter — wired up in `socket.service.ts`, attached to the same `http.Server` as Express in `index.ts` (Socket.io needs the raw server, not just the Express app, so `index.ts` now builds one explicitly with `http.createServer(app)` instead of calling `app.listen()` directly).

- **Room = channel.** "Publish to a per-fixture channel" is a Socket.io room (`fixture:<fixtureId>`, from `fixtureRoom()` in `@leaguelive/shared`) backed transparently by Redis pub/sub via the adapter — not a second, hand-rolled Redis channel running in parallel. `io.to(room).emit(...)` already fans out across every server instance once the adapter's attached; that fan-out *is* what "Redis as the pub/sub adapter" buys you.
- **Protocol lives in `@leaguelive/shared`** (`types/realtime.ts`): `REALTIME_CLIENT_EVENTS.JOIN_FIXTURE`/`LEAVE_FIXTURE` (client emits a bare fixture id string to join/leave its room) and `REALTIME_SERVER_EVENTS.MATCH_EVENT`/`FIXTURE_STATE` (server broadcasts to the room). Nothing here assumes a browser — the Socket.io client SDK works identically for fan-web and fan-app, so this is the one thing both subscribe to without either needing web-specific plumbing.
- **Public, unauthenticated.** No auth handshake on the socket connection, and `GET /fixtures/:fixtureId/live` (the initial fast-read, registered *before* `router.use(authenticate)` in `routes/fixtures.ts` so it's never gated) needs no permission either — live scores are fan-facing (FR32), unlike every other endpoint in this API, which is an org-internal admin surface.
- **Dedicated Redis connections for pub/sub.** A subscribed ioredis connection can't run other commands, so `socket.service.ts` duplicates the app's existing Redis client (`redisClient.duplicate()`, same connection options) into a dedicated pub/sub pair rather than sharing the one used for refresh tokens, or hardcoding a second `REDIS_URL`.

### Live match state, Redis-cached / Mongo-sourced (FR30)

`live-match-state.service.ts`'s `refreshLiveMatchState()` is the only thing that writes the cache: it recomputes a `LiveMatchState` snapshot (`status`, `home_score`/`away_score`, `started_at`/`ended_at`/`result_locked_at`) from MongoDB — Fixture plus a live goal count via `match-score.service.ts`'s `countGoalsByTeam()` (or the frozen official score, once `result_locked_at` is set) — and writes it to Redis (`live_match_state:<fixtureId>`, 6h TTL) under a key `getLiveMatchState()` reads first, falling back to a fresh recompute if the cache is missing or expired. Redis never holds independently-derived state; it's always a materialized view of Mongo, which is what "backed by MongoDB as the source of truth" means concretely here.

`countGoalsByTeam()` lives in its own module (`match-score.service.ts`), not `fixture.service.ts` where it conceptually belongs, purely to break a circular import: `fixture.service.ts` needs to call into `live-match-state.service.ts` to broadcast after a mutation, and `live-match-state.service.ts` needs the goal-counting logic — neither can depend on the other, so both depend on a third, dependency-free module instead.

`refreshAndBroadcastLiveMatchState(fixtureId, matchEvent?)` is the combined "refresh the cache, then push it" call site used by `startMatchSession`/`endMatchSession`/`confirmResult` (`fixture.service.ts`) and `createMatchEvent` (`match-event.service.ts`, only when a genuinely new event was created — a replayed idempotent submission was already broadcast the first time). **It's deliberately best-effort** — unlike `recordAuditLogEntry`, a failure here (Redis down, an emit throwing) is caught and logged, never propagated to fail the request. The audit log's failure-fails-the-request policy exists because the audit trail is a compliance requirement; a missed live-score push is a degraded fan experience, not a broken mutation — the underlying `MatchEvent`/`Fixture` change already committed to MongoDB regardless.

**Scope note:** this task is FR30 plus the live-update half of FR29 ("pushes live event updates... within a target latency"). It doesn't touch FR31's standings-computation half — see Standings below — or promotion/relegation, which stays the separate, admin-triggered `LeagueSystem.endSeason` flow.

## Standings (FR31)

`standings.service.ts`'s `computeCompetitionTable(competitionId)` computes a competition's current table from its confirmed (`result_locked_at` set) fixtures and its own `ruleset`. This is deliberately the *other* half of FR31 from promotion/relegation — it only computes a table; it never calls into `LeagueSystem.endSeason` or anything promotion/relegation related, which stays a separate, manually triggered admin action.

- **Functional core, imperative shell.** `buildCompetitionTable(entries, results, ruleset)` is a pure function — no database access — that does all the actual counting, points, and tiebreaker-sorting logic; `computeCompetitionTable()` is a thin wrapper that fetches a competition's `CompetitionEntry`s and confirmed `Fixture`s from MongoDB, maps them to plain objects, and calls it. This split exists specifically so the logic worth testing carefully (the sorting) is testable in milliseconds with no database at all — see `standings.service.test.ts`.
- **"Incrementally as each result is confirmed"** is satisfied by always reading fresh from MongoDB rather than maintaining any cache or running total: call `computeCompetitionTable()` after fixture N is confirmed and the table reflects fixture N, with nothing to invalidate or drift. There's no eager recompute-and-cache wired into `confirmResult()` (unlike live match state, above) — nothing was asked to consume it there, and inventing a cache with nothing reading it would be pure waste.
- **The sort order *is* the tiebreaker chain.** `ruleset.tiebreakers` (e.g. the default `["points", "goal_difference", "goals_for"]`) is applied as a single ordered multi-key comparator — the first criterion is the primary sort, each subsequent one only matters among rows still tied on everything before it. There's no separate "primary sort key" concept; `points` is just the first tiebreaker. `STANDINGS_TIEBREAKERS` (`@leaguelive/shared`) is the fixed, code-defined set of supported criteria — same reasoning as the Permission catalog: each one corresponds to an actual comparison implemented in code, so `ruleset.tiebreakers` (FR15, unstructured) can only reference ones that exist. A final fallback (`competition_entry_id`) guarantees fully deterministic output even when every configured criterion ties.
- **Ruleset reading is defensive**, same as `format.config`: `ruleset` is unstructured (`Schema.Types.Mixed`) at the schema level, so a missing/malformed `points` or `tiebreakers` falls back to the default rather than throwing. `DEFAULT_STANDINGS_POINTS`/`DEFAULT_STANDINGS_TIEBREAKERS` (`@leaguelive/shared`) are the single source of truth for that default, used both as `Competition`'s own schema default and as this fallback, so the two can't drift apart.
- Every registered `CompetitionEntry` appears in the table, including ones with zero played games (all-zero stats) — not just entries with confirmed results. Whether a zero-played entry ranks above or below another zero-points entry still follows the normal tiebreaker chain (goal difference, etc.), not "unplayed sorts last."
- `GET /competitions/:competitionId/standings` — public, same reasoning as `GET /fixtures/:fixtureId/live`: a league table is fan-facing (FR34), not an org-internal admin action.

## League Systems, promotion & relegation (FR21-FR23)

All gated behind **`competition.manage`**.

- `POST/GET /league-systems`, `GET/PATCH/DELETE /league-systems/:leagueSystemId` — `{ name, scope, rules: { promote_count, relegate_count }, tiers? }`. `scope` is free-form (e.g. `"national"`), same pattern as `Team.category`. `rules` (FR22) applies uniformly at every adjacent tier boundary — FR21's own example, "top N promoted, bottom N relegated," describes one rule, not a per-boundary configuration. Deleting a League System doesn't touch the Competitions it links — it only *links* them (FR21), it doesn't own them, unlike e.g. a Competition owning its entries.
- `PUT /league-systems/:leagueSystemId/tiers` — `{ competition_ids }` — the dedicated "link competitions into a league system" action. Replaces the whole ordered tier list in one call (array position = tier rank, index 0 = top tier — no separate tier-number field). Every id must be a Competition **in the same Organization**; duplicates are rejected.

### Ending a season (FR22/FR23)

`POST /league-systems/:leagueSystemId/end-season` — `{ season, standings: [{ competition_id, entries }], next_season_competition_ids }`, one `standings` entry and one `next_season_competition_ids` entry per tier, **in tier order**.

**This is always a deliberate admin action.** There is no scheduled job, cron, or automatic trigger anywhere in this codebase that calls it — the platform has no reliable way to know a season is actually over (no calendar/season-tracking concept exists), so ending one is only ever a manual API call, per the brief overriding FR22's literal "applied automatically" wording.

**Standings are input, not computed.** `entries` is the final order of `CompetitionEntry` ids for that tier's competition, best to worst, supplied directly by the caller. There's no match-result data anywhere yet (`Fixture` has no score, `MatchEvent`/live standings computation is FR25-31, not built) — building a real standings-computation engine ahead of that data existing would be premature, so "given a completed season's final standings" is taken literally: the admin provides the final order, and `CompetitionStanding` (a new, effectively immutable model — no update/delete route, fields `immutable: true`) locks it. A `(competition_id, season)` unique index stops the same tier/season from being locked twice (409).

**`computePromotionRelegation()`** in `league-system.service.ts` is a pure function (no DB access) — given the League System's ordered tiers/rules and a locked standing for each tier, it returns the list of movements (which `CompetitionEntry` moves, from which competition, to which, promoted or relegated). Kept separate from the orchestration around it specifically so it's a discrete, independently testable unit.

**`endSeason()`** is the orchestration: validates every tier's standings and the corresponding next-season competition up front (before any writes, to keep the non-transactional partial-failure window small), locks each tier's `CompetitionStanding`, calls `computePromotionRelegation()`, then creates a new `CompetitionEntry` in each moved team's new tier's *next season's* competition (their old entry is left alone — it's the historical record of that season). Only the affected (promoted/relegated) teams get a new entry created; teams staying in their tier are **not** automatically carried over — that's a different, simpler operation the brief didn't ask this endpoint to do.

## Audit log

Every mutating request writes an `AuditLogEntry` (FR10): actor, action (`create` / `update` / `delete`), the resource type and id, before/after snapshots where relevant, and a timestamp. `recordAuditLogEntry()` in `src/services/audit-log.service.ts` is the one place that knows how to write one — `role.service.ts`'s create/update/delete/assign/unassign, `organization.service.ts`'s create/update, `auth.service.ts`'s signup, `club`/`venue`/`team`/`player`/`roster.service.ts`'s create/update/delete, `competition`/`competition-entry`/`fixture.service.ts`'s create/update/delete (including reporter assignment, session start/end, and result confirmation, all logged as a Fixture `update`), `match-event.service.ts`'s createMatchEvent (skipped on an idempotent replay — nothing changed, so nothing to log), and `league-system.service.ts`'s create/update/delete/setTiers/endSeason (which itself writes one `CompetitionStanding` entry per tier plus one `CompetitionEntry` entry per promoted/relegated team) each call it once, right after their mutation succeeds, rather than each re-implementing the write. It's awaited as part of the request: if the audit write fails, the request fails too, rather than silently completing a mutation with no trail.

A service call rather than response-intercepting middleware was the deliberate choice here — capturing "before" state generically from HTTP request/response would need to reverse-engineer domain knowledge the service layer already has directly (what the document looked like before the change), and awaiting the write before the response is sent is what makes "audit failure fails the request" possible at all; a middleware wrapping `res.json` can only fire the write after the response has already gone out.

**Append only (FR11).** There is no update or delete route for audit log entries anywhere — `src/routes/audit-log-entries.ts` only ever registers `GET`. The model backs this up: every field is `immutable: true`, and a `pre` hook on `updateOne`/`updateMany`/`findOneAndUpdate`/`deleteOne`/`deleteMany`/`findOneAndDelete` throws, so even code calling those methods directly (bypassing the API) is blocked — not just the route table.

- `GET /audit-log-entries` — `?organization_id?&before?&limit?` (max 200, default 50), newest first
- `GET /audit-log-entries/:entryId`

Both require `audit.view` (FR12). An org-scoped caller always sees only their own Organization's entries — `organization_id` in the query is ignored for them, same `organizationScopeFilter()` pattern as roles. A Platform Operator sees across every Organization, optionally narrowed with `?organization_id=`.

Note `organization_id` on an entry is the affected resource's Organization, not necessarily the actor's — when a Platform Operator acts on Organization X's data, that entry shows up in Organization X's own audit log too, which is what makes "view your own Organization's log" actually complete.

**Scope note:** only mutating *business-data* endpoints are audited — signup (creates a `User`), the Role/UserRole CRUD, Organization create/update (which itself writes three entries: the Organization, its first admin `User`, and the `UserRole` assigning them — see Organization onboarding, above), the Club/Venue/Team/Player/RosterEntry CRUD, the Competition/CompetitionEntry/Fixture CRUD, match reporting (start/end/events/confirm), and the League System CRUD/tiers/end-season (above). Login/refresh/logout aren't, since they don't mutate a tracked resource with a meaningful before/after shape (there's nothing for FR10's "before and after values" to describe). Seed scripts also aren't audited — FR10 says "every mutating *request*," and seed scripts run outside any HTTP request as a one-off, developer-run operation.

See [../../docs/SRS.md](../../docs/SRS.md) for functional requirements.
