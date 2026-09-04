import { MATCH_EVENT_TYPES } from "@leaguelive/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import * as matchEventService from "../services/match-event.service";
import { requireUser } from "../utils/require-user";

const fixtureParamsSchema = z.object({
  fixtureId: z.string().min(1),
});

export async function listMatchEvents(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const events = await matchEventService.listMatchEvents(requireUser(req), fixtureId);
  res.status(200).json({ matchEvents: events.map((event) => event.toJSON()) });
}

const createMatchEventSchema = z.object({
  client_event_id: z.string().trim().min(1).max(100),
  type: z.enum(MATCH_EVENT_TYPES),
  minute: z.number().int().min(0),
  team_id: z.string().min(1),
  player_id: z.string().min(1).nullable().optional(),
  details: z.record(z.unknown()).optional(),
});

/** FR26/FR27: idempotent on client_event_id — a replayed offline-queued submission returns 200, a genuinely new one returns 201. */
export async function createMatchEvent(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const input = createMatchEventSchema.parse(req.body);
  const { event, created } = await matchEventService.createMatchEvent(requireUser(req), fixtureId, input);
  res.status(created ? 201 : 200).json({ matchEvent: event.toJSON() });
}
