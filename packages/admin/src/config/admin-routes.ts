import type { PermissionKey } from "@leaguelive/shared";

/**
 * FR9/NFR10: the single route-to-permission mapping. The sidebar
 * (components/Sidebar.tsx) and the page guard (components/AdminGuard.tsx)
 * both read this same list — neither invents its own access check — so a
 * route is reachable by direct navigation if and only if it's also shown in
 * the sidebar (FR9's own wording).
 *
 * Every later admin panel prompt adds its routes here rather than building
 * a bespoke check: one new entry gets a page both linked in the sidebar
 * (when the viewer can reach it) and guarded (when they navigate to it
 * directly), for free.
 *
 * This is a usability safeguard, not the security boundary (NFR10) — the
 * backend enforces the same permission independently on every request
 * regardless of what this file says.
 */
export interface AdminRoute {
  path: string;
  label: string;
  /**
   * Which permission(s) unlock this route. Empty = visible to any
   * authenticated user, no specific permission required (e.g. the
   * dashboard). More than one key = accessible with *any* one of them, not
   * all — there's no route in this panel (yet) that needs two permissions
   * at once to reach.
   */
  permissions: PermissionKey[];
}

export const ADMIN_ROUTES: AdminRoute[] = [
  { path: "/", label: "Dashboard", permissions: [] },

  // --- Platform Operator (organization.manage is platform scoped — see
  // packages/shared/src/types/permission.ts) ---
  { path: "/organizations", label: "Organizations", permissions: ["organization.manage"] },

  // --- Organization scoped ---
  { path: "/roles", label: "Roles & Permissions", permissions: ["role.manage"] },
  { path: "/clubs", label: "Clubs", permissions: ["roster.manage"] },
  { path: "/venues", label: "Venues", permissions: ["roster.manage"] },
  { path: "/teams", label: "Teams", permissions: ["roster.manage"] },
  { path: "/players", label: "Players", permissions: ["roster.manage"] },
  { path: "/competitions", label: "Competitions", permissions: ["competition.manage"] },
  { path: "/league-systems", label: "League Systems", permissions: ["competition.manage"] },
  // Either permission unlocks the page — a reporter.assign-only holder still
  // needs to reach this page to assign reporters, they just won't see the
  // fixture.manage-gated edit/delete actions once there (see
  // app/(protected)/fixtures/page.tsx's per-button PermissionGates).
  { path: "/fixtures", label: "Fixtures", permissions: ["fixture.manage", "reporter.assign"] },
  { path: "/moderation", label: "Moderation", permissions: ["results.verify"] },

  // audit.view is held by both a Platform Operator (sees every Organization)
  // and an org-scoped verifier/admin (sees only their own) — the backend
  // scopes the same GET /audit-log-entries call automatically depending on
  // who's asking (see audit-log.service.ts's listAuditLogEntries), so this
  // is one route/one page for both audiences, not two.
  { path: "/audit-log", label: "Audit Log", permissions: ["audit.view"] },
];

/**
 * Longest-prefix match, so a future detail/edit sub-route (e.g.
 * "/competitions/abc123") resolves to its section's entry
 * ("/competitions") without needing its own mapping row. A path that
 * matches nothing has no entry here at all — AdminGuard treats that as
 * inaccessible (fail closed), which is what keeps "every route lives in
 * this mapping" an enforced rule rather than a convention someone can
 * forget.
 */
export function findAdminRoute(pathname: string): AdminRoute | undefined {
  const matches = ADMIN_ROUTES.filter((route) =>
    route.path === "/" ? pathname === "/" : pathname === route.path || pathname.startsWith(`${route.path}/`),
  );
  return [...matches].sort((a, b) => b.path.length - a.path.length)[0];
}
