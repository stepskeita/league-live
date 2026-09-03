import type { PermissionKey } from "@leaguelive/shared";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organization_id: string | null;
        // Populated lazily by requirePermission() the first time it's
        // needed, and reused for the rest of the request.
        permissions?: PermissionKey[];
      };
    }
  }
}

export {};
