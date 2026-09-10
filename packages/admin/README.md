# @leaguelive/admin

LeagueLive's admin panel (Next.js App Router, `next dev`/`build` with Turbopack). Used by Platform Operators to onboard and audit Organizations platform-wide, and by an Organization's own staff to run everything within it — competitions, rosters, fixtures, reporter assignment, role management, moderation, and the Organization's own audit log.

## Setup

```
cp .env.example .env
npm run dev -w @leaguelive/admin   # or: cd packages/admin && npm run dev
```

Edit `.env` if the backend isn't reachable at `http://localhost:4000` — see `.env.example`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm start` — production build and serve
- `npm run lint` / `npm run typecheck`

## The permission-gated shell (FR9/NFR10)

Everything in this panel is built on one piece of infrastructure, added before any individual page existed, so every later view plugs into it rather than inventing its own access check:

- **`src/config/admin-routes.ts`** — the single route-to-permission mapping (`ADMIN_ROUTES`). Each entry is `{ path, label, permissions }`; an empty `permissions` array means "any authenticated user," more than one key means "any one of them unlocks it" (no route needs two at once). `findAdminRoute()` does longest-prefix matching so a future detail route (e.g. `/competitions/abc123`) inherits its section's entry automatically, and fails closed — a path with no matching entry is treated as inaccessible, not silently open. **Adding a page means adding one row here — nothing else reads or defines access on its own.**
- **`src/lib/auth-context.tsx`** — `AuthProvider`/`useAuth()`. On session load (and after login) fetches both `GET /auth/me` and `GET /auth/me/permissions` once and shares the result via `hasPermission()`/`hasAnyPermission()`. No screen fetches either endpoint itself.
- **`src/components/Sidebar.tsx`** — renders only the `ADMIN_ROUTES` entries `hasAnyPermission` unlocks. Reads the same mapping the guard does, so the sidebar and what's actually reachable never drift apart.
- **`src/components/AdminGuard.tsx`** — sits once in `app/(protected)/layout.tsx`, wrapping every protected page. Looks up the current path in `ADMIN_ROUTES` and renders `AccessDenied` if the mapping has no entry or the signed-in user's permissions don't unlock it. This is a **usability safeguard, not the security boundary** — the backend enforces the same permission independently on every request regardless of what this file says (NFR10).
- **`src/components/PermissionGate.tsx`** — the per-action counterpart, used inside a page to hide (not just disable) one button a permitted viewer of the page still shouldn't get to use — e.g. an Edit/Delete pair on a page whose *view* only needs a weaker permission. For disabling rather than hiding, call `hasPermission()`/`hasAnyPermission()` directly instead.

## Structure

- `src/app/login/` — public sign-in
- `src/app/(protected)/` — everything behind auth; its `layout.tsx` renders `Sidebar` + `TopBar` + `AdminGuard`, and redirects to `/login` when signed out
  - `page.tsx` — dashboard: welcome, Platform Operator note, the caller's own effective permission chips
  - `organizations/`, `audit-log/`, `roles/`, `clubs/`, `venues/`, `teams/`, `players/`, `competitions/`, `league-systems/`, `fixtures/`, `moderation/` — one directory per `ADMIN_ROUTES` entry, see below
- `src/components/ui/` — `Table`, `Modal`, `Field`/`TextInput`/`Select`/`TextArea`/`Checkbox`, `Button`, `Banner`, `ConfirmDialog`, `PageHeader` — the shared primitives every resource page is built from
- `src/lib/` — `api.ts` (the shared API client, configured with this app's token storage), `auth-context.tsx`, `token-store.ts` (`localStorage`-backed, SSR-guarded), `error.ts` (`getErrorMessage`)

## Views

**Platform Operator (organization scope: `platform`):**
- **Organizations** (`organization.manage`) — list every Organization; "Onboard Organization" creates the Organization and its first admin in one call (nested `admin{name,email,phone?,password}` in the same request, matching the backend's one-shot onboarding); edit covers name/type/country/confederation/contact only, not the admin account.

**Organization scoped, everything else (`organization` scope permissions):**
- **Roles & Permissions** (`role.manage`) — CRUD against Role, built directly on the Permission/Role/UserRole APIs; the permission checklist a role can be given is filtered to `scope: "organization"` keys for an org-scoped caller (a Platform Operator sees the full catalog). Assigning/removing a role from a user is a raw user-ID input, not a picker — **there's no backend endpoint to list users within an Organization**, so this is a known, deliberate limitation surfaced in the UI itself rather than glossed over.
- **Clubs / Venues / Teams / Players** (`roster.manage`) — straightforward CRUD. Teams additionally has a "Roster" action per row for season-scoped player↔team assignment (`GET/POST/DELETE /teams/:id/roster`).
- **Competitions** (`competition.manage`) — CRUD (name/category/format/ruleset/season); `format.config` and `ruleset` are both intentionally unstructured on the backend, so they're edited here as raw JSON textareas rather than a bespoke form per format. Each competition also has an "Entries" action to add/remove Teams — a competition can draw in a Team from a *different* Organization (FR17), so entry is a raw team-ID input alongside a same-Organization picker, not a picker alone.
- **League Systems** (`competition.manage`) — CRUD, a "Tiers" action to set the ordered top-to-bottom list of linked Competitions, and a clearly separated, **destructive-styled "End Season" action** with its own confirmation flow: it pre-fills each tier's final standing from the live computed table (editable via up/down reordering before confirming, since ending a season is a deliberate admin decision, not just whatever the live table says at that instant — see `EndSeasonInput`'s comment in `@leaguelive/shared`), lets the admin pick each tier's competition for the following season, and only actually submits after typing `END SEASON` into `ConfirmDialog`'s `requireTypedConfirmation` — irreversible, so it can't be a stray double-click.
- **Fixtures** (`fixture.manage` **or** `reporter.assign` — either unlocks the page, since a reporter-assign-only holder still needs to reach it) — CRUD is gated to `fixture.manage` at the button level via `PermissionGate`; reporter assignment is its own visually distinct "Reporter" action gated to `reporter.assign`, a separate permission from `fixture.manage` on the backend. Same known limitation as Roles: assignment is a raw user-ID input, no user directory exists yet.
- **Moderation** (`results.verify`) — system-generated anomaly flags (no create action — FR40 is automatic detection, not user reporting) with an open/resolved filter and a resolve action taking an optional note; a separate disciplinary-records lookup, per competition, computed by the backend from confirmed card events.
- **Audit Log** (`audit.view`) — one page for both audiences. The backend scopes `GET /audit-log-entries` to the caller automatically (a Platform Operator sees every Organization, an org-scoped user only their own), so this page just adds an Organization filter dropdown when the signed-in user *is* a Platform Operator. Cursor-paginated ("Load more" using the oldest loaded entry's timestamp), with a detail view showing the recorded before/after payload.

Every page-level access check above comes from `ADMIN_ROUTES`; every per-button gate (Edit/Delete/Assign/End Season/etc.) comes from `PermissionGate` or a direct `hasPermission()` check, not a hardcoded role-name comparison anywhere in this package.

## Design

Plain CSS Modules, no UI/component library, no Tailwind — same "don't add a dependency for this" discipline as `reporter-app`. Accent color is a distinct blue (`--color-primary`, `src/app/globals.css`), different from `reporter-app`'s green, so the two products don't look like the same app.

## Using `@leaguelive/shared`

Every request/response shape and domain type comes from `@leaguelive/shared` (`createLeagueLiveApiClient`, `ApiRequestError`, `PermissionKey`, `Organization`, `Role`, `Fixture`, etc.) rather than being redefined locally — `src/lib/api.ts` is a small adapter wiring the shared client to this app's `localStorage`-backed token storage, nothing more.

See [../../docs/SRS.md](../../docs/SRS.md) for functional requirements.
