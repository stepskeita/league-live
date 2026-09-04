import { PERMISSIONS, type PermissionKey } from "@leaguelive/shared";
import { Types } from "mongoose";
import { Organization } from "../models/organization.model";
import { Role, type RoleDocument } from "../models/role.model";
import { User } from "../models/user.model";
import { UserRole, type UserRoleDocument } from "../models/user-role.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { AppError } from "../utils/app-error";
import { isDuplicateKeyError } from "../utils/mongo-errors";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

const ALL_PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);
// "Organization Admin (all permissions)" (FR6) means all permissions
// *relevant to running one Organization* — platform scoped permissions
// (like organization.manage) must stay out of this or every Organization
// Admin would incidentally gain Platform Operator's cross-Organization reach.
const ORGANIZATION_PERMISSION_KEYS = PERMISSIONS.filter((permission) => permission.scope === "organization").map(
  (permission) => permission.key,
);
const REPORTER_PERMISSION_KEYS: PermissionKey[] = ["match.report"];

export interface CreateRoleInput {
  name: string;
  permission_keys: PermissionKey[];
  // Only meaningful for a Platform Operator (organization_id: null); an
  // org-scoped caller can only ever create roles in their own Organization.
  organization_id?: string;
}

export interface UpdateRoleInput {
  name?: string;
  permission_keys?: PermissionKey[];
}

export async function listRoles(requestingUser: RequestingUser): Promise<RoleDocument[]> {
  return Role.find(organizationScopeFilter(requestingUser)).sort({ name: 1 });
}

export async function getRole(requestingUser: RequestingUser, roleId: string): Promise<RoleDocument> {
  const role = await Role.findOne({ _id: roleId, ...organizationScopeFilter(requestingUser) });
  if (!role) {
    throw new AppError("Role not found", 404);
  }
  return role;
}

export async function createRole(requestingUser: RequestingUser, input: CreateRoleInput): Promise<RoleDocument> {
  const organizationId = await resolveScopeForCreate(requestingUser, input.organization_id);

  let role: RoleDocument;
  try {
    role = await Role.create({
      organization_id: organizationId,
      name: input.name,
      permission_keys: input.permission_keys,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("A role with this name already exists in this scope", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "Role",
    resource_id: role._id,
    after: role.toJSON(),
  });

  return role;
}

export async function updateRole(
  requestingUser: RequestingUser,
  roleId: string,
  input: UpdateRoleInput,
): Promise<RoleDocument> {
  const role = await getRole(requestingUser, roleId);
  const before = role.toJSON();

  if (input.name !== undefined) {
    role.name = input.name;
  }
  if (input.permission_keys !== undefined) {
    role.permission_keys = input.permission_keys;
  }

  try {
    await role.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("A role with this name already exists in this scope", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: role.organization_id,
    action: "update",
    resource_type: "Role",
    resource_id: role._id,
    before,
    after: role.toJSON(),
  });

  return role;
}

export async function deleteRole(requestingUser: RequestingUser, roleId: string): Promise<void> {
  const role = await getRole(requestingUser, roleId);
  const before = role.toJSON();

  await UserRole.deleteMany({ role_id: role._id });
  await role.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: role.organization_id,
    action: "delete",
    resource_type: "Role",
    resource_id: role._id,
    before,
  });
}

export async function listRoleAssignments(
  requestingUser: RequestingUser,
  roleId: string,
): Promise<UserRoleDocument[]> {
  const role = await getRole(requestingUser, roleId);
  return UserRole.find({ role_id: role._id });
}

export async function assignRole(
  requestingUser: RequestingUser,
  roleId: string,
  targetUserId: string,
): Promise<UserRoleDocument> {
  const role = await getRole(requestingUser, roleId);

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError("User not found", 404);
  }
  if (!sameScope(targetUser.organization_id, role.organization_id)) {
    throw new AppError("User and role must belong to the same Organization", 400);
  }

  const existing = await UserRole.findOne({ user_id: targetUser._id, role_id: role._id });
  if (existing) {
    throw new AppError("User already holds this role", 409);
  }

  let assignment: UserRoleDocument;
  try {
    assignment = await UserRole.create({
      user_id: targetUser._id,
      role_id: role._id,
      organization_id: role.organization_id,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("User already holds this role", 409);
    }
    throw err;
  }

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: role.organization_id,
    action: "create",
    resource_type: "UserRole",
    resource_id: assignment._id,
    after: assignment.toJSON(),
  });

  return assignment;
}

export async function unassignRole(
  requestingUser: RequestingUser,
  roleId: string,
  targetUserId: string,
): Promise<void> {
  const role = await getRole(requestingUser, roleId);

  const assignment = await UserRole.findOne({ user_id: targetUserId, role_id: role._id });
  if (!assignment) {
    throw new AppError("User does not hold this role", 404);
  }
  const before = assignment.toJSON();

  await assignment.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: role.organization_id,
    action: "delete",
    resource_type: "UserRole",
    resource_id: assignment._id,
    before,
  });
}

/**
 * FR6: every newly onboarded Organization gets two default roles. Idempotent
 * — safe to call again for an Organization that already has them.
 */
export async function seedDefaultRolesForOrganization(
  organizationId: Types.ObjectId | string,
): Promise<{ organizationAdminRole: RoleDocument; reporterRole: RoleDocument }> {
  const orgId = typeof organizationId === "string" ? new Types.ObjectId(organizationId) : organizationId;

  const organizationAdminRole = await Role.findOneAndUpdate(
    { organization_id: orgId, name: "Organization Admin" },
    { $setOnInsert: { permission_keys: ORGANIZATION_PERMISSION_KEYS } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const reporterRole = await Role.findOneAndUpdate(
    { organization_id: orgId, name: "Reporter" },
    { $setOnInsert: { permission_keys: REPORTER_PERMISSION_KEYS } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { organizationAdminRole, reporterRole };
}

/**
 * The Platform Operator's elevated, cross-Organization access (docs/SRS.md
 * section 2, FR1) is not a hardcoded role-name check anywhere (NFR5) — it
 * works through the exact same mechanism as any other role: a platform
 * scoped (organization_id: null) Role holding every permission key, assigned
 * via UserRole like any other. Idempotent.
 */
export async function seedPlatformOperatorRole(): Promise<RoleDocument> {
  return Role.findOneAndUpdate(
    { organization_id: null, name: "Platform Operator" },
    { $setOnInsert: { permission_keys: ALL_PERMISSION_KEYS } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function ensureRoleAssignment(userId: Types.ObjectId, role: RoleDocument): Promise<UserRoleDocument> {
  return UserRole.findOneAndUpdate(
    { user_id: userId, role_id: role._id },
    { $setOnInsert: { organization_id: role.organization_id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function resolveScopeForCreate(
  requestingUser: RequestingUser,
  requestedOrganizationId: string | undefined,
): Promise<Types.ObjectId | null> {
  if (requestingUser.organization_id) {
    // Org-scoped callers can only ever manage their own Organization's roles
    // — any organization_id in the request body is ignored, not trusted.
    return new Types.ObjectId(requestingUser.organization_id);
  }

  if (!requestedOrganizationId) {
    // Platform Operator, no organization_id given: a platform scoped role.
    return null;
  }

  const organizationExists = await Organization.exists({ _id: requestedOrganizationId });
  if (!organizationExists) {
    throw new AppError("Organization not found", 400);
  }
  return new Types.ObjectId(requestedOrganizationId);
}

function sameScope(a: Types.ObjectId | null, b: Types.ObjectId | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.equals(b);
}
