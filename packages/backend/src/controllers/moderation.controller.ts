import { ANOMALY_FLAG_STATUSES } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as anomalyFlagService from "../services/anomaly-flag.service";
import * as disciplineService from "../services/discipline.service";
import { requireUser } from "../utils/require-user";

// --- FR40: anomaly flags / review queue ---

const listAnomalyFlagsQuerySchema = z.object({
  status: z.enum(ANOMALY_FLAG_STATUSES).optional(),
  fixture_id: z.string().min(1).optional(),
});

export async function listAnomalyFlags(req: Request, res: Response): Promise<void> {
  const query = listAnomalyFlagsQuerySchema.parse(req.query);
  const flags = await anomalyFlagService.listAnomalyFlags(requireUser(req), query);
  res.status(200).json({ anomalyFlags: flags.map((flag) => flag.toJSON()) });
}

const flagParamsSchema = z.object({
  flagId: z.string().min(1),
});

export async function getAnomalyFlag(req: Request, res: Response): Promise<void> {
  const { flagId } = flagParamsSchema.parse(req.params);
  const flag = await anomalyFlagService.getAnomalyFlag(requireUser(req), flagId);
  res.status(200).json({ anomalyFlag: flag.toJSON() });
}

const resolveAnomalyFlagSchema = z.object({
  resolution_note: z.string().trim().max(500).optional(),
});

export async function resolveAnomalyFlag(req: Request, res: Response): Promise<void> {
  const { flagId } = flagParamsSchema.parse(req.params);
  const { resolution_note } = resolveAnomalyFlagSchema.parse(req.body);
  const flag = await anomalyFlagService.resolveAnomalyFlag(requireUser(req), flagId, resolution_note);
  res.status(200).json({ anomalyFlag: flag.toJSON() });
}

// --- FR41: disciplinary records ---

const competitionParamsSchema = z.object({
  competitionId: z.string().min(1),
});

export async function listDisciplinaryRecords(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  const records = await disciplineService.computeDisciplinaryRecords(requireUser(req), competitionId);
  res.status(200).json({ disciplinaryRecords: records });
}

const playerDisciplineParamsSchema = z.object({
  competitionId: z.string().min(1),
  playerId: z.string().min(1),
});

export async function getPlayerDisciplinaryRecord(req: Request, res: Response): Promise<void> {
  const { competitionId, playerId } = playerDisciplineParamsSchema.parse(req.params);
  const record = await disciplineService.getPlayerDisciplinaryRecord(requireUser(req), competitionId, playerId);
  res.status(200).json({ disciplinaryRecord: record });
}
