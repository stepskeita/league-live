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
 * requires one to exist, and `organization.manage` isn't named either, but
 * FR1 ("Platform Operator can onboard a new Organization") needs one.
 *
 * `scope` says who can legitimately hold the permission:
 *  - "organization": grantable within a single Organization — safe to fold
 *    into that Organization's own "Organization Admin (all permissions)"
 *    default role (FR6).
 *  - "platform": only meaningful platform-wide (creating/listing/managing
 *    Organizations themselves, across every Organization). Seeding an
 *    Organization's own admin role must exclude these, or every Organization
 *    Admin would incidentally become a Platform Operator — see
 *    role.service.ts's ORGANIZATION_PERMISSION_KEYS vs ALL_PERMISSION_KEYS.
 */
export const PERMISSION_SCOPES = ["organization", "platform"] as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const PERMISSIONS = [
  { key: "competition.manage", description: "Create and configure competitions.", scope: "organization" },
  { key: "fixture.manage", description: "Schedule and edit fixtures.", scope: "organization" },
  {
    key: "results.verify",
    description: "Review and correct match events before a result is marked official.",
    scope: "organization",
  },
  {
    key: "roster.manage",
    description: "Register teams, clubs, venues, and manage player rosters.",
    scope: "organization",
  },
  { key: "reporter.assign", description: "Assign a reporter to a fixture.", scope: "organization" },
  {
    key: "match.report",
    description: "Start/end a match session and log live match events for an assigned fixture.",
    scope: "organization",
  },
  {
    key: "role.manage",
    description: "Create, rename, and edit roles and their permissions.",
    scope: "organization",
  },
  { key: "user.manage", description: "Manage user accounts within an Organization.", scope: "organization" },
  {
    key: "org.settings.manage",
    description: "Manage an Organization's own settings.",
    scope: "organization",
  },
  { key: "audit.view", description: "View an Organization's audit log.", scope: "organization" },
  {
    key: "organization.manage",
    description: "Onboard new Organizations, and list, view, or edit any Organization platform-wide.",
    scope: "platform",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key) as [
  PermissionKey,
  ...PermissionKey[],
];

export interface Permission {
  key: PermissionKey;
  description: string;
  scope: PermissionScope;
}
