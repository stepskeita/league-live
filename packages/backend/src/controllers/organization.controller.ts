import { ORGANIZATION_TYPES } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as organizationService from "../services/organization.service";
import { requireUser } from "../utils/require-user";

const contactSchema = z.object({
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
});

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(ORGANIZATION_TYPES),
  country: z.string().trim().min(1).nullable().optional(),
  confederation: z.string().trim().min(1).nullable().optional(),
  contact: contactSchema,
  admin: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email(),
    phone: z.string().trim().optional(),
    password: z.string().min(8).max(128),
  }),
});

export async function createOrganization(req: Request, res: Response): Promise<void> {
  const input = createOrganizationSchema.parse(req.body);
  const { organization, adminUser } = await organizationService.createOrganization(requireUser(req), input);
  res.status(201).json({ organization: organization.toJSON(), adminUser: adminUser.toJSON() });
}

export async function listOrganizations(_req: Request, res: Response): Promise<void> {
  const organizations = await organizationService.listOrganizations();
  res.status(200).json({ organizations: organizations.map((organization) => organization.toJSON()) });
}

const organizationParamsSchema = z.object({
  organizationId: z.string().min(1),
});

export async function getOrganization(req: Request, res: Response): Promise<void> {
  const { organizationId } = organizationParamsSchema.parse(req.params);
  const organization = await organizationService.getOrganization(organizationId);
  res.status(200).json({ organization: organization.toJSON() });
}

const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  type: z.enum(ORGANIZATION_TYPES).optional(),
  country: z.string().trim().min(1).nullable().optional(),
  confederation: z.string().trim().min(1).nullable().optional(),
  contact: contactSchema.optional(),
});

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  const { organizationId } = organizationParamsSchema.parse(req.params);
  const input = updateOrganizationSchema.parse(req.body);
  const organization = await organizationService.updateOrganization(requireUser(req), organizationId, input);
  res.status(200).json({ organization: organization.toJSON() });
}
