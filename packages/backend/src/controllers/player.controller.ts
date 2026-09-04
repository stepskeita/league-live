import { PLAYER_POSITIONS } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as playerService from "../services/player.service";
import { requireUser } from "../utils/require-user";

const pastDate = z.coerce.date().refine((value) => value.getTime() < Date.now(), {
  message: "date_of_birth must be in the past",
});

const playerParamsSchema = z.object({
  playerId: z.string().min(1),
});

const createPlayerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  position: z.enum(PLAYER_POSITIONS),
  date_of_birth: pastDate,
  organization_id: z.string().optional(),
});

export async function createPlayer(req: Request, res: Response): Promise<void> {
  const input = createPlayerSchema.parse(req.body);
  const player = await playerService.createPlayer(requireUser(req), input);
  res.status(201).json({ player: player.toJSON() });
}

export async function listPlayers(req: Request, res: Response): Promise<void> {
  const players = await playerService.listPlayers(requireUser(req));
  res.status(200).json({ players: players.map((player) => player.toJSON()) });
}

export async function getPlayer(req: Request, res: Response): Promise<void> {
  const { playerId } = playerParamsSchema.parse(req.params);
  const player = await playerService.getPlayer(requireUser(req), playerId);
  res.status(200).json({ player: player.toJSON() });
}

const updatePlayerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  position: z.enum(PLAYER_POSITIONS).optional(),
  date_of_birth: pastDate.optional(),
});

export async function updatePlayer(req: Request, res: Response): Promise<void> {
  const { playerId } = playerParamsSchema.parse(req.params);
  const input = updatePlayerSchema.parse(req.body);
  const player = await playerService.updatePlayer(requireUser(req), playerId, input);
  res.status(200).json({ player: player.toJSON() });
}

export async function deletePlayer(req: Request, res: Response): Promise<void> {
  const { playerId } = playerParamsSchema.parse(req.params);
  await playerService.deletePlayer(requireUser(req), playerId);
  res.status(204).send();
}
