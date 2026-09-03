import type { Request, Response } from "express";
import { z } from "zod";
import * as auditLogService from "../services/audit-log.service";
import { requireUser } from "../utils/require-user";

const listQuerySchema = z.object({
  organization_id: z.string().optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function listAuditLogEntries(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  const entries = await auditLogService.listAuditLogEntries(requireUser(req), query);
  res.status(200).json({ auditLogEntries: entries.map((entry) => entry.toJSON()) });
}

const entryParamsSchema = z.object({
  entryId: z.string().min(1),
});

export async function getAuditLogEntry(req: Request, res: Response): Promise<void> {
  const { entryId } = entryParamsSchema.parse(req.params);
  const entry = await auditLogService.getAuditLogEntry(requireUser(req), entryId);
  res.status(200).json({ auditLogEntry: entry.toJSON() });
}
