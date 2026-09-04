import type { Request, Response } from "express";
import { z } from "zod";
import * as leagueSystemService from "../services/league-system.service";
import { requireUser } from "../utils/require-user";

const leagueSystemParamsSchema = z.object({
  leagueSystemId: z.string().min(1),
});

const rulesSchema = z.object({
  promote_count: z.number().int().min(0),
  relegate_count: z.number().int().min(0),
});

const createLeagueSystemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(100),
  rules: rulesSchema,
  tiers: z.array(z.string().min(1)).optional(),
  organization_id: z.string().optional(),
});

export async function createLeagueSystem(req: Request, res: Response): Promise<void> {
  const input = createLeagueSystemSchema.parse(req.body);
  const leagueSystem = await leagueSystemService.createLeagueSystem(requireUser(req), input);
  res.status(201).json({ leagueSystem: leagueSystem.toJSON() });
}

export async function listLeagueSystems(req: Request, res: Response): Promise<void> {
  const leagueSystems = await leagueSystemService.listLeagueSystems(requireUser(req));
  res.status(200).json({ leagueSystems: leagueSystems.map((leagueSystem) => leagueSystem.toJSON()) });
}

export async function getLeagueSystem(req: Request, res: Response): Promise<void> {
  const { leagueSystemId } = leagueSystemParamsSchema.parse(req.params);
  const leagueSystem = await leagueSystemService.getLeagueSystem(requireUser(req), leagueSystemId);
  res.status(200).json({ leagueSystem: leagueSystem.toJSON() });
}

const updateLeagueSystemSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  scope: z.string().trim().min(1).max(100).optional(),
  rules: rulesSchema.optional(),
});

export async function updateLeagueSystem(req: Request, res: Response): Promise<void> {
  const { leagueSystemId } = leagueSystemParamsSchema.parse(req.params);
  const input = updateLeagueSystemSchema.parse(req.body);
  const leagueSystem = await leagueSystemService.updateLeagueSystem(requireUser(req), leagueSystemId, input);
  res.status(200).json({ leagueSystem: leagueSystem.toJSON() });
}

export async function deleteLeagueSystem(req: Request, res: Response): Promise<void> {
  const { leagueSystemId } = leagueSystemParamsSchema.parse(req.params);
  await leagueSystemService.deleteLeagueSystem(requireUser(req), leagueSystemId);
  res.status(204).send();
}

// FR21: "add an endpoint to link competitions into a league system" — replaces the whole ordered tier list.
const setTiersSchema = z.object({
  competition_ids: z.array(z.string().min(1)),
});

export async function setTiers(req: Request, res: Response): Promise<void> {
  const { leagueSystemId } = leagueSystemParamsSchema.parse(req.params);
  const { competition_ids } = setTiersSchema.parse(req.body);
  const leagueSystem = await leagueSystemService.setTiers(requireUser(req), leagueSystemId, competition_ids);
  res.status(200).json({ leagueSystem: leagueSystem.toJSON() });
}

// FR22/FR23: the deliberate, manually triggered "end season" action.
const endSeasonSchema = z.object({
  season: z.string().trim().min(1).max(20),
  standings: z
    .array(
      z.object({
        competition_id: z.string().min(1),
        entries: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(2),
  next_season_competition_ids: z.array(z.string().min(1)).min(2),
});

export async function endSeason(req: Request, res: Response): Promise<void> {
  const { leagueSystemId } = leagueSystemParamsSchema.parse(req.params);
  const input = endSeasonSchema.parse(req.body);
  const result = await leagueSystemService.endSeason(requireUser(req), leagueSystemId, input);
  res.status(200).json({
    standings: result.standings.map((standing) => standing.toJSON()),
    movements: result.movements.map((movement) => ({
      competition_entry_id: movement.competition_entry_id.toString(),
      from_competition_id: movement.from_competition_id.toString(),
      to_competition_id: movement.to_competition_id.toString(),
      direction: movement.direction,
    })),
    newEntries: result.newEntries.map((entry) => entry.toJSON()),
  });
}
