import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

// FR36: "subscribe to push notifications for a team." There's no sign-in
// anywhere on the fan-facing apps this serves (fan-web, fan-app), so a
// subscription is identified by the browser/device's own push endpoint —
// not a user id — same identity the Push API itself uses. One document per
// (team, endpoint) pair rather than an array of team ids on one endpoint
// document: lets "who follows Team X" and "does this endpoint already
// follow Team X" both stay simple, indexed queries.
export interface PushSubscriptionAttrs {
  team_id: Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionDocument extends PushSubscriptionAttrs, Document {}

const pushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    team_id: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  withBaseOptions<PushSubscriptionDocument>(),
);

pushSubscriptionSchema.index({ team_id: 1, endpoint: 1 }, { unique: true });

export const PushSubscription = model<PushSubscriptionDocument>("PushSubscription", pushSubscriptionSchema);
