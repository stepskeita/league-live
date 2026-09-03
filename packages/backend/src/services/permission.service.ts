import type { PermissionKey } from "@leaguelive/shared";
import { Role } from "../models/role.model";
import { UserRole } from "../models/user-role.model";

/**
 * FR7: a user's effective permissions are the union of every role assigned
 * to them — never a check against a role name (NFR5).
 */
export async function getEffectivePermissions(userId: string): Promise<PermissionKey[]> {
  const assignments = await UserRole.find({ user_id: userId }).select("role_id").lean();
  if (assignments.length === 0) {
    return [];
  }

  const roleIds = assignments.map((assignment) => assignment.role_id);
  const roles = await Role.find({ _id: { $in: roleIds } })
    .select("permission_keys")
    .lean();

  const permissions = new Set<PermissionKey>();
  for (const role of roles) {
    for (const key of role.permission_keys) {
      permissions.add(key);
    }
  }

  return Array.from(permissions);
}
