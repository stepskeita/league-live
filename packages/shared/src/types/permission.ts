/**
 * The fixed, code defined catalog of permissions (docs/SRS.md FR4). This is
 * not stored in the database — every key here must correspond to an actual
 * enforced check in the backend, so new permissions are added here, in code,
 * alongside the check they guard.
 *
 * `match.report` isn't one of FR4's named examples, but FR26 ("Reporter logs
 * events in real time") needs a permission of its own for the default
 * Reporter role (FR6) to actually hold — every other catalog entry here is
 * an admin-side action. Likewise `audit.view` isn't named in FR4, but FR12
 * ("A user holding the appropriate permission can view the audit log")
 * requires one to exist.
 */
export const PERMISSIONS = [
  { key: "competition.manage", description: "Create and configure competitions." },
  { key: "fixture.manage", description: "Schedule and edit fixtures." },
  {
    key: "results.verify",
    description: "Review and correct match events before a result is marked official.",
  },
  { key: "roster.manage", description: "Register teams, clubs, venues, and manage player rosters." },
  { key: "reporter.assign", description: "Assign a reporter to a fixture." },
  {
    key: "match.report",
    description: "Submit live match events and the post-match confirmation for an assigned fixture.",
  },
  { key: "role.manage", description: "Create, rename, and edit roles and their permissions." },
  { key: "user.manage", description: "Manage user accounts within an Organization." },
  { key: "org.settings.manage", description: "Manage an Organization's own settings." },
  { key: "audit.view", description: "View an Organization's audit log." },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key) as [
  PermissionKey,
  ...PermissionKey[],
];

export interface Permission {
  key: PermissionKey;
  description: string;
}
