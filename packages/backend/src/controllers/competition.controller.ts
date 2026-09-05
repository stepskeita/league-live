import { COMPETITION_FORMATS } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as competitionEntryService from "../services/competition-entry.service";
import * as competitionService from "../services/competition.service";
import { computeCompetitionTable } from "../services/standings.service";
import { requireUser } from "../utils/require-user";

const formatSchema = z.object({
  type: z.enum(COMPETITION_FORMATS),
  config: z.record(z.unknown()).default({}),
});

const competitionParamsSchema = z.object({
  competitionId: z.string().min(1),
});

const createCompetitionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  format: formatSchema,
  ruleset: z.record(z.unknown()).optional(),
  season: z.string().trim().min(1).max(20),
  organization_id: z.string().optional(),
});

export async function createCompetition(req: Request, res: Response): Promise<void> {
  const input = createCompetitionSchema.parse(req.body);
  const competition = await competitionService.createCompetition(requireUser(req), input);
  res.status(201).json({ competition: competition.toJSON() });
}

export async function listCompetitions(req: Request, res: Response): Promise<void> {
  const competitions = await competitionService.listCompetitions(requireUser(req));
  res.status(200).json({ competitions: competitions.map((competition) => competition.toJSON()) });
}

export async function getCompetition(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  const competition = await competitionService.getCompetition(requireUser(req), competitionId);
  res.status(200).json({ competition: competition.toJSON() });
}

const updateCompetitionSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  format: formatSchema.optional(),
  ruleset: z.record(z.unknown()).optional(),
  season: z.string().trim().min(1).max(20).optional(),
});

export async function updateCompetition(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  const input = updateCompetitionSchema.parse(req.body);
  const competition = await competitionService.updateCompetition(requireUser(req), competitionId, input);
  res.status(200).json({ competition: competition.toJSON() });
}

export async function deleteCompetition(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  await competitionService.deleteCompetition(requireUser(req), competitionId);
  res.status(204).send();
}

/**
 * FR31/FR34, public — no authenticate(), no permission. A league table is
 * fan-facing (like GET /fixtures/:id/live), not an org-internal admin
 * action like the rest of this router. Always computed fresh from confirmed
 * fixtures — see standings.service.ts for why that's the correct reading of
 * "incrementally as each result is confirmed".
 */
export async function getCompetitionStandings(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  const table = await computeCompetitionTable(competitionId);
  res.status(200).json({ standings: table });
}

// --- FR17: this competition's entries ---

export async function listCompetitionEntries(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  const entries = await competitionEntryService.listCompetitionEntries(requireUser(req), competitionId);
  res.status(200).json({ competitionEntries: entries.map((entry) => entry.toJSON()) });
}

const addCompetitionEntrySchema = z.object({
  team_id: z.string().min(1),
});

export async function addCompetitionEntry(req: Request, res: Response): Promise<void> {
  const { competitionId } = competitionParamsSchema.parse(req.params);
  const input = addCompetitionEntrySchema.parse(req.body);
  const entry = await competitionEntryService.addCompetitionEntry(requireUser(req), competitionId, input);
  res.status(201).json({ competitionEntry: entry.toJSON() });
}

const competitionEntryParamsSchema = z.object({
  competitionId: z.string().min(1),
  entryId: z.string().min(1),
});

export async function removeCompetitionEntry(req: Request, res: Response): Promise<void> {
  const { competitionId, entryId } = competitionEntryParamsSchema.parse(req.params);
  await competitionEntryService.removeCompetitionEntry(requireUser(req), competitionId, entryId);
  res.status(204).send();
}
