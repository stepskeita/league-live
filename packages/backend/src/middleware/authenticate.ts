import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/token.service";
import { AppError } from "../utils/app-error";

/**
 * Verifies the request's access token and attaches `req.user`. This only
 * establishes identity — it does not check what that identity is allowed to
 * do; permission checks are a separate concern layered on top of this.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError("Missing or invalid Authorization header", 401));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.user = { id: payload.sub, organization_id: payload.organization_id };
    next();
  } catch (err) {
    next(err);
  }
}
