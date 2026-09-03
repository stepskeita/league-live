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

Roles (FR5/FR6) are dynamic, organization scoped documents that hold any combination of permission keys from the catalog. A `Role.organization_id` of `null` means the role is platform scoped (applies across every Organization) rather than tied to one, which is how the Platform Operator's elevated access works — as an ordinary role holding every permission, not a hardcoded role-name check anywhere (NFR5).

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

`npm run seed:default-roles` backfills the two FR6 default roles — **Organization Admin** (every permission) and **Reporter** (`match.report` only) — for every Organization that doesn't have them yet. `seedDefaultRolesForOrganization()` in `role.service.ts` is what a future "onboard an Organization" endpoint should call directly for one Organization at creation time; both paths are idempotent and never overwrite a role's permissions if it already exists (so an Organization's own customization of its default roles is never clobbered by re-seeding).

**Known gap:** nothing in this codebase yet creates an Organization through the API (only the model exists), so `seed:default-roles` currently has nothing to backfill until Organizations are created directly in the database or that onboarding endpoint is built.

## Audit log

Every mutating request writes an `AuditLogEntry` (FR10): actor, action (`create` / `update` / `delete`), the resource type and id, before/after snapshots where relevant, and a timestamp. `recordAuditLogEntry()` in `src/services/audit-log.service.ts` is the one place that knows how to write one — `role.service.ts`'s create/update/delete/assign/unassign and `auth.service.ts`'s signup each call it once, right after their mutation succeeds, rather than each re-implementing the write. It's awaited as part of the request: if the audit write fails, the request fails too, rather than silently completing a mutation with no trail.

A service call rather than response-intercepting middleware was the deliberate choice here — capturing "before" state generically from HTTP request/response would need to reverse-engineer domain knowledge the service layer already has directly (what the document looked like before the change), and awaiting the write before the response is sent is what makes "audit failure fails the request" possible at all; a middleware wrapping `res.json` can only fire the write after the response has already gone out.

**Append only (FR11).** There is no update or delete route for audit log entries anywhere — `src/routes/audit-log-entries.ts` only ever registers `GET`. The model backs this up: every field is `immutable: true`, and a `pre` hook on `updateOne`/`updateMany`/`findOneAndUpdate`/`deleteOne`/`deleteMany`/`findOneAndDelete` throws, so even code calling those methods directly (bypassing the API) is blocked — not just the route table.

- `GET /audit-log-entries` — `?organization_id?&before?&limit?` (max 200, default 50), newest first
- `GET /audit-log-entries/:entryId`

Both require `audit.view` (FR12). An org-scoped caller always sees only their own Organization's entries — `organization_id` in the query is ignored for them, same `organizationScopeFilter()` pattern as roles. A Platform Operator sees across every Organization, optionally narrowed with `?organization_id=`.

Note `organization_id` on an entry is the affected resource's Organization, not necessarily the actor's — when a Platform Operator acts on Organization X's data, that entry shows up in Organization X's own audit log too, which is what makes "view your own Organization's log" actually complete.

**Scope note:** only mutating *business-data* endpoints are audited — signup (creates a `User`) and the Role/UserRole CRUD. Login/refresh/logout aren't, since they don't mutate a tracked resource with a meaningful before/after shape (there's nothing for FR10's "before and after values" to describe). Seed scripts also aren't audited — FR10 says "every mutating *request*," and seed scripts run outside any HTTP request as a one-off, developer-run operation.

See [../../docs/SRS.md](../../docs/SRS.md) for functional requirements.
