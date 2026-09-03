import type { Request } from "express";
import { AppError } from "./app-error";
import type { RequestingUser } from "./tenant-scope";

/**
 * Routes that use this are expected to run authenticate() first, so this
 * should never actually be missing — it's a typed guard, not a real guard.
 */
export function requireUser(req: Request): RequestingUser {
  if (!req.user) {
    throw new AppError("Not authenticated", 401);
  }
  return req.user;
}
