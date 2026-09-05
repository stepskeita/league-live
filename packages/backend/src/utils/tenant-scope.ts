import type { PermissionKey } from "@leaguelive/shared";
import { Types } from "mongoose";

export interface RequestingUser {
  id: string;
  organization_id: string | null;
  // Mirrors Express.Request["user"]["permissions"] (see types/express.d.ts)
  // — populated once requirePermission()/requireAnyPermission() has
  // resolved it, so a service that needs to branch on *which* permission
  // the caller holds (e.g. match-event.service.ts's listMatchEvents, open
  // to both a reporter and a verifier but authorized differently for each)
  // doesn't have to re-fetch it.
  permissions?: PermissionKey[];
}

/**
 * The concrete "enforced at the data query layer, not just the route
 * handler" mechanism: every query for tenant scoped data must be built by
 * merging this in, never by trusting an :id path param alone. A permission
 * check only proves the caller may perform the action *somewhere* — this is
 * what stops an org.A role.manage holder from acting on org.B's documents by
 * guessing an id, even if a route handler's permission check were missing or
 * wrong.
 *
 * A null organization_id (Platform Operator, see docs/SRS.md section 2) adds
 * no filter at all, matching "not organization scoped."
 */
export function organizationScopeFilter(user: RequestingUser): { organization_id?: Types.ObjectId } {
  return user.organization_id ? { organization_id: new Types.ObjectId(user.organization_id) } : {};
}
