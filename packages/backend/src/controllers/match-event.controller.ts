import { CARD_COLORS, MATCH_EVENT_TYPES } from "@leaguelive/shared";
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
  card_color: z.enum(CARD_COLORS).nullable().optional(),
  details: z.record(z.unknown()).optional(),
});

/** FR26/FR27: idempotent on client_event_id — a replayed offline-queued submission returns 200, a genuinely new one returns 201. */
export async function createMatchEvent(req: Request, res: Response): Promise<void> {
  const { fixtureId } = fixtureParamsSchema.parse(req.params);
  const input = createMatchEventSchema.parse(req.body);
  const { event, created } = await matchEventService.createMatchEvent(requireUser(req), fixtureId, input);
  res.status(created ? 201 : 200).json({ matchEvent: event.toJSON() });
}

const eventParamsSchema = z.object({
  fixtureId: z.string().min(1),
  eventId: z.string().min(1),
});

const updateMatchEventSchema = z.object({
  type: z.enum(MATCH_EVENT_TYPES).optional(),
  minute: z.number().int().min(0).optional(),
  team_id: z.string().min(1).optional(),
  player_id: z.string().min(1).nullable().optional(),
  card_color: z.enum(CARD_COLORS).nullable().optional(),
  details: z.record(z.unknown()).optional(),
});

/** FR39: a verifier correcting an event before the result is locked. */
export async function updateMatchEvent(req: Request, res: Response): Promise<void> {
  const { fixtureId, eventId } = eventParamsSchema.parse(req.params);
  const input = updateMatchEventSchema.parse(req.body);
  const event = await matchEventService.updateMatchEvent(requireUser(req), fixtureId, eventId, input);
  res.status(200).json({ matchEvent: event.toJSON() });
}

/** FR39: a verifier removing an erroneous event before the result is locked. */
export async function deleteMatchEvent(req: Request, res: Response): Promise<void> {
  const { fixtureId, eventId } = eventParamsSchema.parse(req.params);
  await matchEventService.deleteMatchEvent(requireUser(req), fixtureId, eventId);
  res.status(204).send();
}
