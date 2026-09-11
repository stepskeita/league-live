import type { Request, Response } from "express";
import { z } from "zod";
import * as notificationService from "../services/notification.service";

/** FR36, public — lets the frontend key pushManager.subscribe() against this server's VAPID keypair. */
export function getVapidPublicKey(_req: Request, res: Response): void {
  res.status(200).json({ publicKey: notificationService.getVapidPublicKey() });
}

const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(1),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
});

const subscribeSchema = z.object({
  team_id: z.string().min(1),
  subscription: pushSubscriptionSchema,
});

/** FR36, public — no sign-in on the fan-facing apps this serves; a subscription is identified by its own push endpoint, not a user. */
export async function subscribe(req: Request, res: Response): Promise<void> {
  const { team_id, subscription } = subscribeSchema.parse(req.body);
  await notificationService.subscribeToTeam(team_id, subscription);
  res.status(204).send();
}

const unsubscribeSchema = z.object({
  team_id: z.string().min(1),
  endpoint: z.string().trim().min(1),
});

export async function unsubscribe(req: Request, res: Response): Promise<void> {
  const { team_id, endpoint } = unsubscribeSchema.parse(req.body);
  await notificationService.unsubscribeFromTeam(team_id, endpoint);
  res.status(204).send();
}
