import type { PermissionKey } from "../types/permission";
import type { Role } from "../types/role";
import type { UserRole } from "../types/user-role";
import type { ApiClient } from "./client";

export interface RoleResponse {
  role: Role;
}

export interface ListRolesResponse {
  roles: Role[];
}

export interface CreateRoleInput {
  name: string;
  permission_keys: PermissionKey[];
  /** Only meaningful for a Platform Operator — an org-scoped caller always gets their own Organization regardless of what's sent here. */
  organization_id?: string;
}

export interface UpdateRoleInput {
  name?: string;
  permission_keys?: PermissionKey[];
}

export interface UserRoleResponse {
  userRole: UserRole;
}

export interface ListUserRolesResponse {
  userRoles: UserRole[];
}

/** Built directly against the Permission/Role/UserRole API — role.manage gated on the backend. */
export function createRolesApi(client: ApiClient) {
  return {
    list: () => client.get<ListRolesResponse>("/roles"),
    get: (roleId: string) => client.get<RoleResponse>(`/roles/${roleId}`),
    create: (input: CreateRoleInput) => client.post<RoleResponse>("/roles", input),
    update: (roleId: string, input: UpdateRoleInput) => client.patch<RoleResponse>(`/roles/${roleId}`, input),
    delete: (roleId: string) => client.delete<void>(`/roles/${roleId}`),
    listAssignments: (roleId: string) => client.get<ListUserRolesResponse>(`/roles/${roleId}/assignments`),
    assign: (roleId: string, userId: string) =>
      client.post<UserRoleResponse>(`/roles/${roleId}/assignments`, { user_id: userId }),
    unassign: (roleId: string, userId: string) => client.delete<void>(`/roles/${roleId}/assignments/${userId}`),
  };
}

export type RolesApi = ReturnType<typeof createRolesApi>;
