# Software Requirements Specification & Development Plan
## LeagueLive (working title) — Multi Tenant Football Competition & Live Scores Platform

**Prepared for:** Internal planning / partner conversations (GFF and others)
**Prepared by:** Alieu Keita
**Version:** 0.6 (draft)

---

## 1. Introduction

### 1.1 Purpose
This document defines the requirements and phased development plan for a multi tenant football competition and live scores platform, built to be sold to any federation, confederation, league operator, or competition organizer, in any country, running any number of leagues or divisions. The Gambia Football Federation (GFF) is the design partner and likely first customer. The platform is not built around GFF or around Gambia; it is a product, and GFF is simply where it gets proven first.

### 1.2 Scope
Version 1 is built and proven with one paying organization, most likely GFF, running one or two real competitions. From day one, the data model and architecture are multi tenant, format agnostic, country agnostic, and access controlled by dynamic, assignable roles, enforced consistently in the backend and reflected in the admin panel's own navigation and page access. The fan facing product ships as both a web app and a native mobile app together in v1, not web first with mobile deferred, since for a live scores product mobile is the primary surface fans actually use, not a secondary one.

### 1.3 Definitions
- **Organization (tenant)**: any entity that licenses the platform to run its own competitions.
- **Competition**: a specific tournament or league run by an Organization, with its own category and format.
- **Category**: the classification a competition runs under (men's, women's, youth, veterans, or any other classification an Organization defines).
- **League System**: a set of competitions linked as tiers in a pyramid, with promotion and relegation rules between adjacent tiers.
- **Permission**: a single granular capability enforced somewhere in the system. The catalog of possible permissions is defined by the platform itself.
- **Role**: a named, organization scoped collection of permissions. Roles are created and edited dynamically by an Organization; a small set of default roles ship out of the box.
- **Audit Log**: an append only record of every significant action taken in the system, who did it, what it affected, and when.
- **Reporter**: the person at a venue submitting live match events for a fixture.
- **Standing**: a team's computed position in a competition table, derived from that competition's own ruleset.
- **Licensee**: a third party consuming data through the platform's API.

---

## 2. Stakeholders & User Roles

| Default role | Description |
|---|---|
| Platform Operator | Runs and maintains the platform across every Organization on it. Fixed, not organization scoped |
| Organization Admin | A default full access role for a newly onboarded Organization. Editable, not sacred |
| Reporter | A default role scoped to submitting live match events for assigned fixtures |
| Fan / Public | Unauthenticated or lightly authenticated browsing access on web or mobile, not part of the permission system |
| Licensee | Consumes data via a paid API (phase 3), scoped by API key rather than the staff role system |

A real Organization will often want more than the two default internal roles, for example a Fixture Manager who can schedule matches but not touch finances, or a Results Verifier who can only review the moderation queue. That's what the dynamic role system in section 4.2 is for, and what the admin panel's navigation and page access adapt to.

---

## 3. System Overview

The platform is multi tenant and country agnostic: every competition, team, and fixture belongs to an Organization, and every Organization belongs to a country or a confederation. Within an Organization, who can do what is governed by dynamically assignable roles built from a shared permission catalog, every significant action is recorded to an audit log, and the admin panel only shows and allows navigation to whatever a user's permissions unlock.

Five components, connected by a real time core:

1. **Reporter app** (mobile) — event capture at the venue, offline first.
2. **Backend & realtime engine** — ingests events, computes state per competition, enforces permission checks and writes audit log entries, applies promotion and relegation where a league system defines it, pushes updates.
3. **Admin panel** (web) — organization onboarding, role and permission management, audit log viewing, and per organization competition, fixture, team, and moderation management, with navigation and page access both driven by the current user's permissions.
4. **Fan web app** — public facing scores, tables, and team pages, browsable by country, confederation, and organization, server rendered for SEO discovery.
5. **Fan mobile app** — the same live scores, browsing, tables, team and player pages, and notifications as the fan web app, built as a first class native client from v1, not a later addition.

A public data API is added in a later phase for licensed third parties.

---

## 4. Functional Requirements

### 4.1 Organization & platform administration
- **FR1**: Platform Operator can onboard a new Organization, of any type, in any country.
- **FR2**: Each Organization's data is isolated from other Organizations by default.
- **FR3**: A user can only act within their own Organization, and only within what their assigned role's permissions allow, except where a competition explicitly draws in teams from other Organizations.

### 4.2 Roles, permissions & audit
- **FR4**: Platform Operator maintains a system wide catalog of granular permissions (for example: competition.manage, fixture.manage, results.verify, roster.manage, reporter.assign, role.manage, user.manage, org.settings.manage), each corresponding to an actual enforced check in the backend.
- **FR5**: A user holding role.manage within their Organization can create, rename, or edit custom roles, selecting any combination of permissions from the catalog.
- **FR6**: Every newly onboarded Organization is seeded with two default roles, Organization Admin and Reporter, and can extend or replace them with custom roles at any time.
- **FR7**: Users can be assigned one or more roles within their Organization; a user's effective permissions are the union of every role assigned to them.
- **FR8**: A user can fetch their own effective permission set through the API, for client applications to drive their own UI.
- **FR9**: The admin panel's navigation and page access are both driven by a single route to permission mapping, so no section is reachable by direct navigation unless it's also shown in the sidebar, and nothing shown in the sidebar is ever blocked when clicked.
- **FR10**: Every significant action is written to an audit log entry with the actor, the action, the affected resource, a timestamp, and the before and after values where relevant.
- **FR11**: Audit log entries are append only; no role, including Platform Operator, can edit or delete an existing entry.
- **FR12**: A user holding the appropriate permission can view the audit log for their own Organization; Platform Operator can view audit logs across every Organization.

### 4.3 Competition & fixture management
- **FR13**: A user with competition.manage can create a competition with a configurable category.
- **FR14**: A user with competition.manage can choose a competition's format (league table, knockout, or group stage plus knockout).
- **FR15**: Standings rules are configurable per competition, not hardcoded.
- **FR16**: A user with roster.manage can register teams, club details, and venues.
- **FR17**: A competition's participating teams can be drawn from other Organizations on the platform.
- **FR18**: A user with fixture.manage can schedule fixtures within any competition they have access to.
- **FR19**: A user with reporter.assign can assign a reporter to each fixture.
- **FR20**: A user with roster.manage can manage player rosters per team per season.

### 4.4 League systems, promotion & relegation
- **FR21**: A user with competition.manage can define a League System that links several competitions as tiers.
- **FR22**: A League System defines promotion and relegation rules between adjacent tiers, applied automatically at season end.
- **FR23**: A country or Organization can run multiple independent League Systems.

### 4.5 Match reporting (Reporter app)
- **FR24**: Reporter logs in and sees only fixtures assigned to them.
- **FR25**: Reporter can start and end a match session.
- **FR26**: Reporter logs events in real time: goals, cards, substitutions, half time, full time.
- **FR27**: The app queues events locally and syncs automatically when connectivity returns.
- **FR28**: Reporter submits a post match confirmation that locks the official result.

### 4.6 Live data & realtime engine
- **FR29**: The system pushes live event updates to connected clients within a target latency (see NFR1).
- **FR30**: The system maintains live match state per fixture.
- **FR31**: The system auto computes standings after each confirmed result and applies promotion or relegation at season end where a League System defines them.

### 4.7 Fan facing platform
- **FR32**: Users can view live scores across all in progress matches, across organizations, countries, and categories.
- **FR33**: Users can browse fixtures and results by country, confederation, organization, competition, category, team, or date.
- **FR34**: Users can view a league table or a knockout bracket, whichever a competition's format calls for.
- **FR35**: Users can view team and player pages, including season stats.
- **FR36**: Users can subscribe to push notifications for a team, via web push on the web app and native push on the mobile app.
- **FR37**: Web pages are server rendered and indexable for search discovery.
- **FR38**: The fan mobile app provides the same live score, browsing, table/bracket, team/player, and notification functionality as the fan web app, as a first class native client, not a wrapper around the web experience.

### 4.8 Verification & moderation
- **FR39**: A user with results.verify can review and correct events before a result is marked official.
- **FR40**: The system flags anomalies for review.
- **FR41**: Disciplinary records are tracked per player, per competition, across a season.

### 4.9 Data licensing API (phase 3)
- **FR42**: The system exposes an authenticated API for licensed consumption of live and historical data.
- **FR43**: Platform Operator can issue and revoke licensee API keys and monitor usage.

---

## 5. Non Functional Requirements

| ID | Requirement |
|---|---|
| NFR1 | Event propagation latency under 5 seconds from reporter submission to fan facing display, on both web and mobile |
| NFR2 | Reporter app remains usable offline and syncs automatically on reconnect |
| NFR3 | System supports concurrent coverage of every fixture across every onboarded Organization, plus several thousand concurrent fan sessions across web and mobile combined at launch scale |
| NFR4 | 99%+ uptime during active match windows |
| NFR5 | Access control is permission based and enforced at the data layer, never against a hardcoded role name |
| NFR6 | Audit log entries are immutable and retained for the life of the account at minimum |
| NFR7 | Reporter app and fan mobile app perform acceptably on low and mid range Android devices, the common device class across most target markets |
| NFR8 | English language UI for v1, structured for future localization |
| NFR9 | Adding a new Organization, country, competition category, league system, custom role, or permission assignment requires configuration only, never a schema change or code deployment |
| NFR10 | Frontend route and navigation guards in the admin panel are a usability safeguard, not the security boundary; the backend enforces the same permission checks independently |
| NFR11 | The fan web app and fan mobile app read from the same API and realtime layer, so neither one is ever missing data or lagging behind the other |

---

## 6. System Architecture

**Reporter app**: React Native (Expo). Offline first with a local write queue, minimal UI, aware of which Organization and competition its assigned fixtures belong to.

**Fan mobile app**: React Native (Expo), sharing a common set of TypeScript types and an API client package with the reporter app and the admin panel, so the four clients don't each redefine the same shapes. Consumes the same realtime layer as the fan web app for live score pushes, and native push notifications (FCM/APNs via Expo) for team alerts.

**Fan web app**: Next.js, server rendered for SEO on match, team, country, and organization pages, using web push for notification alerts.

**Backend & realtime engine**: Node.js/Express, Socket.io, Redis for pub/sub and rate limiting, MongoDB for match, event, role, and audit data. Every request passes through a permission checking middleware that resolves the acting user's effective permissions before touching any organization scoped data, and a logging layer that writes an audit entry for every mutating request. The notification service supports both web push and native mobile push from one backend interface.

**Admin panel**: Next.js dashboard. A single route to permission mapping drives both the sidebar and a page level guard, so a section hidden from navigation is never reachable by direct URL, and nothing shown is ever blocked when clicked.

**Hosting**: cloud VPS or AWS, Cloudflare in front for caching, DNS resilience, and geographic distribution.

---

## 7. Data Model (high level entities)

- **Organization** — id, name, type, country (nullable), confederation, contact
- **Club** — id, organization_id, name
- **Team** — id, organization_id, club_id, name, category, venue
- **Player** — id, team_id, name, position, date of birth
- **Venue** — id, organization_id, name, location
- **Permission** — id, key, description
- **Role** — id, organization_id (nullable for Platform Operator), name, permission_ids
- **UserRole** — id, user_id, role_id
- **AuditLogEntry** — id, organization_id (nullable), actor_user_id, action, resource_type, resource_id, before, after, timestamp. Append only
- **League System** — id, name, scope, ordered tiers, promotion/relegation rules
- **Competition** — id, organization_id, name, category, format config, ruleset, season, league_system_id (nullable), tier (nullable)
- **Competition Entry** — id, competition_id, team_id
- **Fixture** — id, competition_id, home entry, away entry, venue_id, datetime, status, assigned reporter
- **MatchEvent** — id, fixture_id, type, player, minute, team
- **Standing** — derived: team, competition, played, won, drawn, lost, goals for, goals against, goal difference, points
- **User** — id, organization_id (nullable for Platform Operator), name, contact, assigned roles via UserRole
- **NotificationSubscription** — id, device or browser identifier, channel (web push / native push), team_id followed

---

## 8. External Interfaces

- **Organization registration systems**: an optional future integration point per Organization to pull master data.
- **Push notification service**: for fan goal/match alerts, supporting both web push (fan web app) and native push via FCM/APNs (fan mobile app) from one backend interface.
- **Licensee API** (phase 3): authenticated REST/webhook access.
- **SMS/WhatsApp fallback** (optional, phase 2+): for reporters at venues with very poor data connectivity.

---

## 9. Assumptions & Constraints

- Cooperation from the first onboarded Organization (planned: GFF) is required to assign official reporters and supply fixture and roster data.
- The permission catalog itself is defined and versioned by the platform team; what's dynamic is how permissions get grouped into roles and assigned to people.
- Building the fan web app and fan mobile app together in v1 roughly doubles the frontend surface area of the MVP compared to a web only launch; this is accepted because mobile is the primary way fans actually consume live scores, not a nice to have.
- The admin panel's route to permission mapping lives in the frontend codebase and changes when a new page is added, unlike roles and permission assignments, which change through the product itself.
- Cross organization and cross border competitions require a light data sharing or result verification agreement between the Organizations involved.
- Venue connectivity is inconsistent in many target markets, so offline first design on the reporter app is not optional.
- Initial build is a single developer effort; shipping both fan clients together means v1's competition and organization scope stays deliberately narrow to keep the total build achievable.

---

## 10. Development Plan

### Phase 0 — Validate (2 to 4 weeks)
Manually track a handful of real matches via spreadsheet or WhatsApp with one or two volunteer reporters. Runs in parallel with initial GFF conversations.

### Phase 1 — MVP build (12 to 16 weeks)
Reporter app, backend and realtime engine, the dynamic role and permission system, audit logging, and a permission aware admin panel sidebar and page guard, all as foundational pieces. The fan web app and fan mobile app are built together in this phase, sharing an API client and type package, with full functional parity between them. Proven with one Organization across at least one league and one knockout competition, both a men's and a women's category, and at least one custom role beyond the two defaults. The timeline is longer than a web only MVP would be, since two fan facing clients are shipping at once rather than one now and one later.

### Phase 2 — First organization pilot (4 to 8 weeks)
Run live across real matchdays. Collect accuracy and reliability data on both fan clients as well as the reporter workflow.

### Phase 3 — Expand
More competitions and categories, onboarding additional Organizations, activating full league system tooling and cross organization competitions, deeper stats, and full disciplinary tracking.

### Phase 4 — Monetize
Sponsorship placement per organization, licensee API, and a defined pricing model for organizations joining after the first.

---

## 11. Success Metrics

- 95%+ of match events visible to fans within the target latency during the pilot, on both web and mobile.
- Zero discrepancies between platform computed standings and the pilot Organization's official records.
- Onboarding a second Organization requires configuration only, no code changes.
- Creating a new custom role changes a user's admin panel, both sidebar and direct navigation, with no code change or deployment.
- The fan web app and fan mobile app show identical live data and no functional gap between them during the pilot.
- Every mutating action taken during the pilot has a corresponding audit log entry.

---

## 12. Open Questions

- Pricing and packaging model across organizations.
- Whether match commissioners can be mandated to report digitally, or whether a club appointed reporter role needs to be created instead.
- How disputes over shared results get resolved for cross organization competitions.
- How much branding and customization each Organization gets versus a shared platform experience.
- How soon non English language support becomes necessary.
- Whether permission granularity should eventually go beyond resource/action level.
- Whether building both fan clients simultaneously in v1 is still the right call if the timeline slips significantly during Phase 1; worth a checkpoint partway through rather than assuming it either way.
