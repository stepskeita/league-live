import type { OrganizationType } from "@leaguelive/shared";
import { Types } from "mongoose";
import { Organization, type OrganizationDocument } from "../models/organization.model";
import type { UserDocument } from "../models/user.model";
import { recordAuditLogEntry } from "./audit-log.service";
import { ensureRoleAssignment, seedDefaultRolesForOrganization } from "./role.service";
import { createUserAccount } from "./user.service";
import { AppError } from "../utils/app-error";
import type { RequestingUser } from "../utils/tenant-scope";

/**
 * Resolves which Organization a *new, always org-scoped* resource (Club,
 * Team, Venue, Player, ...) belongs to. Unlike Role, these can never be
 * platform scoped (there's no such thing as a Club with no Organization),
 * so — unlike role.service.ts's resolveScopeForCreate — a Platform Operator
 * MUST supply organization_id; there's no null fallback.
 */
export async function resolveOrganizationScopeForCreate(
  requestingUser: RequestingUser,
  requestedOrganizationId: string | undefined,
): Promise<Types.ObjectId> {
  if (requestingUser.organization_id) {
    // Org-scoped callers can only ever create resources in their own
    // Organization — anything in the request body is ignored, not trusted.
    return new Types.ObjectId(requestingUser.organization_id);
  }

  if (!requestedOrganizationId) {
    throw new AppError("organization_id is required", 400);
  }

  const organization = await Organization.exists({ _id: requestedOrganizationId });
  if (!organization) {
    throw new AppError("Organization not found", 400);
  }
  return new Types.ObjectId(requestedOrganizationId);
}

export interface CreateOrganizationInput {
  name: string;
  type: OrganizationType;
  country?: string | null;
  confederation?: string | null;
  contact: { email: string; phone?: string };
  admin: { name: string; email: string; phone?: string; password: string };
}

export interface CreateOrganizationResult {
  organization: OrganizationDocument;
  adminUser: UserDocument;
}

/**
 * FR1: Platform Operator onboards a new Organization. This is one API call
 * doing three things — create the Organization, seed its two default roles
 * (FR6), and create + assign its first Organization Admin — because without
 * that last step nobody holds role.manage in the new Organization and no
 * further role assignment could ever happen there (see role.service.ts's
 * seedPlatformOperatorRole for the same bootstrap problem, solved the same
 * way, for the platform level).
 *
 * Not wrapped in a transaction (consistent with deleteRole's cascading
 * delete elsewhere in this codebase): if admin-account creation fails after
 * the Organization and its default roles were created, the Organization is
 * left admin-less but otherwise intact and recoverable — an operator can
 * assign an existing or new user to its "Organization Admin" role through
 * the normal role-assignment endpoints.
 */
export async function createOrganization(
  requestingUser: RequestingUser,
  input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
  const organization = await Organization.create({
    name: input.name,
    type: input.type,
    country: input.country ?? null,
    confederation: input.confederation ?? null,
    contact: input.contact,
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organization._id,
    action: "create",
    resource_type: "Organization",
    resource_id: organization._id,
    after: organization.toJSON(),
  });

  const { organizationAdminRole } = await seedDefaultRolesForOrganization(organization._id);

  const adminUser = await createUserAccount({
    name: input.admin.name,
    email: input.admin.email,
    phone: input.admin.phone,
    password: input.admin.password,
    organization_id: organization._id,
  });

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organization._id,
    action: "create",
    resource_type: "User",
    resource_id: adminUser._id,
    after: adminUser.toJSON(),
  });

  const assignment = await ensureRoleAssignment(adminUser._id, organizationAdminRole);

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organization._id,
    action: "create",
    resource_type: "UserRole",
    resource_id: assignment._id,
    after: assignment.toJSON(),
  });

  return { organization, adminUser };
}

export async function listOrganizations(): Promise<OrganizationDocument[]> {
  return Organization.find({}).sort({ name: 1 });
}

/**
 * FR33: the fan-facing "browse by country / confederation / organization"
 * filter needs to know what Organizations (and which countries/
 * confederations) exist at all — this is the public equivalent of
 * listOrganizations, minus organization.manage.
 */
export async function listPublicOrganizations(): Promise<OrganizationDocument[]> {
  return Organization.find({}).sort({ name: 1 });
}

export async function getOrganization(organizationId: string): Promise<OrganizationDocument> {
  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError("Organization not found", 404);
  }
  return organization;
}

export interface UpdateOrganizationInput {
  name?: string;
  type?: OrganizationType;
  country?: string | null;
  confederation?: string | null;
  contact?: { email: string; phone?: string };
}

export async function updateOrganization(
  requestingUser: RequestingUser,
  organizationId: string,
  input: UpdateOrganizationInput,
): Promise<OrganizationDocument> {
  const organization = await getOrganization(organizationId);
  const before = organization.toJSON();

  if (input.name !== undefined) {
    organization.name = input.name;
  }
  if (input.type !== undefined) {
    organization.type = input.type;
  }
  if (input.country !== undefined) {
    organization.country = input.country;
  }
  if (input.confederation !== undefined) {
    organization.confederation = input.confederation;
  }
  if (input.contact !== undefined) {
    organization.contact = input.contact;
  }

  await organization.save();

  await recordAuditLogEntry({
    actor_user_id: requestingUser.id,
    organization_id: organization._id,
    action: "update",
    resource_type: "Organization",
    resource_id: organization._id,
    before,
    after: organization.toJSON(),
  });

  return organization;
}
