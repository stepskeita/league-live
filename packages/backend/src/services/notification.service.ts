import webpush from "web-push";
import { env } from "../config/env";
import { PushSubscription } from "../models/push-subscription.model";
import { Team } from "../models/team.model";
import { AppError } from "../utils/app-error";

const vapidConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** null when no VAPID keypair is configured — the frontend's subscribe button stays disabled rather than calling pushManager.subscribe() with nothing to key against. */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export async function subscribeToTeam(teamId: string, subscription: PushSubscriptionInput): Promise<void> {
  const team = await Team.exists({ _id: teamId });
  if (!team) {
    throw new AppError("Team not found", 404);
  }

  await PushSubscription.updateOne(
    { team_id: teamId, endpoint: subscription.endpoint },
    { $set: { keys: subscription.keys } },
    { upsert: true },
  );
}

export async function unsubscribeFromTeam(teamId: string, endpoint: string): Promise<void> {
  await PushSubscription.deleteOne({ team_id: teamId, endpoint });
}

export interface NotificationPayload {
  title: string;
  body: string;
  /** Arbitrary extra data the service worker's push handler can act on, e.g. a fixture id to deep link to. */
  data?: Record<string, unknown>;
}

/**
 * FR36: pushes a notification to every subscriber following `teamId`. A
 * no-op (not an error) when no VAPID keypair is configured — see env.ts —
 * so the goal/full-time hooks that call this never fail the request that
 * triggered them just because push isn't set up in this environment.
 * Subscriptions the push service reports as gone (404/410 — the browser
 * unsubscribed, or the endpoint expired) are cleaned up as they're found,
 * the same "prune on delivery failure" pattern most push integrations use
 * since there's no reliable way to know in advance.
 */
export async function notifyTeamFollowers(teamId: string, payload: NotificationPayload): Promise<void> {
  if (!vapidConfigured) {
    return;
  }

  const subscriptions = await PushSubscription.find({ team_id: teamId });
  if (subscriptions.length === 0) {
    return;
  }

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await subscription.deleteOne();
        }
        // Any other failure (a transient push-service error, say) is
        // swallowed here deliberately — one subscriber's delivery problem
        // shouldn't fail the goal/full-time event that triggered this for
        // every other subscriber, and there's no caller waiting on this
        // result to retry.
      }
    }),
  );
}
