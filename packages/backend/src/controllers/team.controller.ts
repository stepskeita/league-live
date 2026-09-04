import type { Request, Response } from "express";
import { z } from "zod";
import * as rosterService from "../services/roster.service";
import * as teamService from "../services/team.service";
import { requireUser } from "../utils/require-user";

const teamParamsSchema = z.object({
  teamId: z.string().min(1),
});

const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(200),
  club_id: z.string().min(1),
  category: z.string().trim().min(1).max(100),
  venue_id: z.string().min(1).nullable().optional(),
  organization_id: z.string().optional(),
});

export async function createTeam(req: Request, res: Response): Promise<void> {
  const input = createTeamSchema.parse(req.body);
  const team = await teamService.createTeam(requireUser(req), input);
  res.status(201).json({ team: team.toJSON() });
}

export async function listTeams(req: Request, res: Response): Promise<void> {
  const teams = await teamService.listTeams(requireUser(req));
  res.status(200).json({ teams: teams.map((team) => team.toJSON()) });
}

export async function getTeam(req: Request, res: Response): Promise<void> {
  const { teamId } = teamParamsSchema.parse(req.params);
  const team = await teamService.getTeam(requireUser(req), teamId);
  res.status(200).json({ team: team.toJSON() });
}

const updateTeamSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  club_id: z.string().min(1).optional(),
  venue_id: z.string().min(1).nullable().optional(),
});

export async function updateTeam(req: Request, res: Response): Promise<void> {
  const { teamId } = teamParamsSchema.parse(req.params);
  const input = updateTeamSchema.parse(req.body);
  const team = await teamService.updateTeam(requireUser(req), teamId, input);
  res.status(200).json({ team: team.toJSON() });
}

export async function deleteTeam(req: Request, res: Response): Promise<void> {
  const { teamId } = teamParamsSchema.parse(req.params);
  await teamService.deleteTeam(requireUser(req), teamId);
  res.status(204).send();
}

// --- FR20: this team's player roster, per season ---

const listRosterQuerySchema = z.object({
  season: z.string().trim().min(1).optional(),
});

export async function listRoster(req: Request, res: Response): Promise<void> {
  const { teamId } = teamParamsSchema.parse(req.params);
  const { season } = listRosterQuerySchema.parse(req.query);
  const entries = await rosterService.listRoster(requireUser(req), teamId, season);
  res.status(200).json({ rosterEntries: entries.map((entry) => entry.toJSON()) });
}

const addToRosterSchema = z.object({
  player_id: z.string().min(1),
  season: z.string().trim().min(1).max(20),
});

export async function addToRoster(req: Request, res: Response): Promise<void> {
  const { teamId } = teamParamsSchema.parse(req.params);
  const input = addToRosterSchema.parse(req.body);
  const entry = await rosterService.addToRoster(requireUser(req), teamId, input);
  res.status(201).json({ rosterEntry: entry.toJSON() });
}

const rosterEntryParamsSchema = z.object({
  teamId: z.string().min(1),
  entryId: z.string().min(1),
});

export async function removeFromRoster(req: Request, res: Response): Promise<void> {
  const { teamId, entryId } = rosterEntryParamsSchema.parse(req.params);
  await rosterService.removeFromRoster(requireUser(req), teamId, entryId);
  res.status(204).send();
}
