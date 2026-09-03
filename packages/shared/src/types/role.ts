import type { PermissionKey } from "./permission";

export interface Role {
  id: string;
  // Null means the role is platform scoped (applies across every
  // Organization) rather than tied to one — see docs/SRS.md section 7.
  organization_id: string | null;
  name: string;
  permission_keys: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}
