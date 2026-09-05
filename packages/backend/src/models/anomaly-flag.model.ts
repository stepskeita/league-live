import { ANOMALY_FLAG_REASONS, ANOMALY_FLAG_STATUSES, type AnomalyFlagReason, type AnomalyFlagStatus } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface AnomalyFlagAttrs {
  organization_id: Types.ObjectId;
  fixture_id: Types.ObjectId;
  match_event_id: Types.ObjectId | null;
  reason: AnomalyFlagReason;
  details: string;
  status: AnomalyFlagStatus;
  resolved_by_user_id: Types.ObjectId | null;
  resolution_note: string | null;
  resolved_at: Date | null;
}

export interface AnomalyFlagDocument extends AnomalyFlagAttrs, Document {}

const anomalyFlagSchema = new Schema<AnomalyFlagDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    fixture_id: {
      type: Schema.Types.ObjectId,
      ref: "Fixture",
      required: true,
      index: true,
    },
    match_event_id: {
      type: Schema.Types.ObjectId,
      ref: "MatchEvent",
      default: null,
    },
    reason: {
      type: String,
      required: true,
      enum: ANOMALY_FLAG_REASONS,
    },
    details: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      required: true,
      enum: ANOMALY_FLAG_STATUSES,
      default: "open",
    },
    resolved_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolution_note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
  },
  withBaseOptions<AnomalyFlagDocument>(),
);

anomalyFlagSchema.index({ organization_id: 1, status: 1 });

export const AnomalyFlag = model<AnomalyFlagDocument>("AnomalyFlag", anomalyFlagSchema);
