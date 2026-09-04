import type { Location } from "@leaguelive/shared";
import type { Types } from "mongoose";
import { Team } from "../models/team.model";
import { Venue, type VenueDocument } from "../models/venue.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { resolveOrganizationScopeForCreate } from "./organization.service";
import { AppError } from "../utils/app-error";
import { organizationScopeFilter, type RequestingUser } from "../utils/tenant-scope";

/**
 * Resolves an optional venue_id to an ObjectId, validating it belongs to the
 * given Organization — shared by team.service.ts and fixture.service.ts, so
 * "a Team/Fixture's venue must be one this Organization actually registered"
 * isn't duplicated between them.
 */
export async function resolveVenueInOrganization(
  organizationId: Types.ObjectId,
  venueId: string | null | undefined,
): Promise<Types.ObjectId | null> {
  if (!venueId) {
    return null;
  }
  const venue = await Venue.findOne({ _id: venueId, organization_id: organizationId });
  if (!venue) {
    throw new AppError("Venue not found in this Organization", 400);
  }
  return venue._id;
}

export interface CreateVenueInput {
  name: string;
  location: Location;
  // Only meaningful for a Platform Operator; an org-scoped caller can only
  // ever create a Venue in their own Organization.
  organization_id?: string;
}

export interface UpdateVenueInput {
  name?: string;
  location?: Location;
}

export async function listVenues(requestingUser: RequestingUser): Promise<VenueDocument[]> {
  return Venue.find(organizationScopeFilter(requestingUser)).sort({ name: 1 });
}

export async function getVenue(requestingUser: RequestingUser, venueId: string): Promise<VenueDocument> {
  const venue = await Venue.findOne({ _id: venueId, ...organizationScopeFilter(requestingUser) });
  if (!venue) {
    throw new AppError("Venue not found", 404);
  }
  return venue;
}

export async function createVenue(requestingUser: RequestingUser, input: CreateVenueInput): Promise<VenueDocument> {
  const organizationId = await resolveOrganizationScopeForCreate(requestingUser, input.organization_id);

  const venue = await Venue.create({
    organization_id: organizationId,
    name: input.name,
    location: input.location,
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organizationId,
    action: "create",
    resource_type: "Venue",
    resource_id: venue._id,
    after: venue.toJSON(),
  });

  return venue;
}

export async function updateVenue(
  requestingUser: RequestingUser,
  venueId: string,
  input: UpdateVenueInput,
): Promise<VenueDocument> {
  const venue = await getVenue(requestingUser, venueId);
  const before = venue.toJSON();

  if (input.name !== undefined) {
    venue.name = input.name;
  }
  if (input.location !== undefined) {
    venue.location = input.location;
  }

  await venue.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: venue.organization_id,
    action: "update",
    resource_type: "Venue",
    resource_id: venue._id,
    before,
    after: venue.toJSON(),
  });

  return venue;
}

export async function deleteVenue(requestingUser: RequestingUser, venueId: string): Promise<void> {
  const venue = await getVenue(requestingUser, venueId);

  const hasTeams = await Team.exists({ venue_id: venue._id });
  if (hasTeams) {
    throw new AppError("Cannot delete a Venue that is still a Team's home venue", 409);
  }

  const before = venue.toJSON();
  await venue.deleteOne();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: venue.organization_id,
    action: "delete",
    resource_type: "Venue",
    resource_id: venue._id,
    before,
  });
}
