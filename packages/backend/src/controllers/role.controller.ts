import { PERMISSION_KEYS } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as roleService from "../services/role.service";
import { requireUser } from "../utils/require-user";

const permissionKeySchema = z.enum(PERMISSION_KEYS);

const roleParamsSchema = z.object({
  roleId: z.string().min(1),
});

const assignmentParamsSchema = z.object({
  roleId: z.string().min(1),
  userId: z.string().min(1),
});

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  permission_keys: z.array(permissionKeySchema).default([]),
  organization_id: z.string().optional(),
});

export async function createRole(req: Request, res: Response): Promise<void> {
  const input = createRoleSchema.parse(req.body);
  const role = await roleService.createRole(requireUser(req), input);
  res.status(201).json({ role: role.toJSON() });
}

export async function listRoles(req: Request, res: Response): Promise<void> {
  const roles = await roleService.listRoles(requireUser(req));
  res.status(200).json({ roles: roles.map((role) => role.toJSON()) });
}

export async function getRole(req: Request, res: Response): Promise<void> {
  const { roleId } = roleParamsSchema.parse(req.params);
  const role = await roleService.getRole(requireUser(req), roleId);
  res.status(200).json({ role: role.toJSON() });
}

const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  permission_keys: z.array(permissionKeySchema).optional(),
});

export async function updateRole(req: Request, res: Response): Promise<void> {
  const { roleId } = roleParamsSchema.parse(req.params);
  const input = updateRoleSchema.parse(req.body);
  const role = await roleService.updateRole(requireUser(req), roleId, input);
  res.status(200).json({ role: role.toJSON() });
}

export async function deleteRole(req: Request, res: Response): Promise<void> {
  const { roleId } = roleParamsSchema.parse(req.params);
  await roleService.deleteRole(requireUser(req), roleId);
  res.status(204).send();
}

const assignRoleSchema = z.object({
  user_id: z.string().min(1),
});

export async function assignRole(req: Request, res: Response): Promise<void> {
  const { roleId } = roleParamsSchema.parse(req.params);
  const { user_id } = assignRoleSchema.parse(req.body);
  const assignment = await roleService.assignRole(requireUser(req), roleId, user_id);
  res.status(201).json({ userRole: assignment.toJSON() });
}

export async function unassignRole(req: Request, res: Response): Promise<void> {
  const { roleId, userId } = assignmentParamsSchema.parse(req.params);
  await roleService.unassignRole(requireUser(req), roleId, userId);
  res.status(204).send();
}

export async function listRoleAssignments(req: Request, res: Response): Promise<void> {
  const { roleId } = roleParamsSchema.parse(req.params);
  const assignments = await roleService.listRoleAssignments(requireUser(req), roleId);
  res.status(200).json({ userRoles: assignments.map((assignment) => assignment.toJSON()) });
}
