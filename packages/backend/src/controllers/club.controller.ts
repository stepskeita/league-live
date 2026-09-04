import type { Request, Response } from "express";
import { z } from "zod";
import * as clubService from "../services/club.service";
import { requireUser } from "../utils/require-user";

const clubParamsSchema = z.object({
  clubId: z.string().min(1),
});

const createClubSchema = z.object({
  name: z.string().trim().min(1).max(200),
  organization_id: z.string().optional(),
});

export async function createClub(req: Request, res: Response): Promise<void> {
  const input = createClubSchema.parse(req.body);
  const club = await clubService.createClub(requireUser(req), input);
  res.status(201).json({ club: club.toJSON() });
}

export async function listClubs(req: Request, res: Response): Promise<void> {
  const clubs = await clubService.listClubs(requireUser(req));
  res.status(200).json({ clubs: clubs.map((club) => club.toJSON()) });
}

export async function getClub(req: Request, res: Response): Promise<void> {
  const { clubId } = clubParamsSchema.parse(req.params);
  const club = await clubService.getClub(requireUser(req), clubId);
  res.status(200).json({ club: club.toJSON() });
}

const updateClubSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
});

export async function updateClub(req: Request, res: Response): Promise<void> {
  const { clubId } = clubParamsSchema.parse(req.params);
  const input = updateClubSchema.parse(req.body);
  const club = await clubService.updateClub(requireUser(req), clubId, input);
  res.status(200).json({ club: club.toJSON() });
}

export async function deleteClub(req: Request, res: Response): Promise<void> {
  const { clubId } = clubParamsSchema.parse(req.params);
  await clubService.deleteClub(requireUser(req), clubId);
  res.status(204).send();
}
