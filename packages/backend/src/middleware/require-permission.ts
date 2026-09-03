import type { PermissionKey } from "@leaguelive/shared";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getEffectivePermissions } from "../services/permission.service";
import { AppError } from "../utils/app-error";

/**
 * Route level guard: 401 if not authenticated, 403 if the caller's effective
 * permissions (FR7 — the union of every role assigned to them) don't include
 * `permission`. This only proves the caller may perform the action
 * *somewhere*; which records they may act on is a separate check enforced at
 * the data query layer (see utils/tenant-scope.ts). Must run after
 * authenticate().
 */
export function requirePermission(permission: PermissionKey): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { user } = req;
    if (!user) {
      next(new AppError("Not authenticated", 401));
      return;
    }

    resolvePermissions(user)
      .then((permissions) => {
        if (!permissions.includes(permission)) {
          next(new AppError("Insufficient permissions", 403));
          return;
        }
        next();
      })
      .catch(next);
  };
}

async function resolvePermissions(user: NonNullable<Request["user"]>): Promise<PermissionKey[]> {
  if (!user.permissions) {
    user.permissions = await getEffectivePermissions(user.id);
  }
  return user.permissions;
}
