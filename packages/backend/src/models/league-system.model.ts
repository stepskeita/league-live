import type { LeagueSystemRules } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface LeagueSystemAttrs {
  organization_id: Types.ObjectId;
  name: string;
  scope: string;
  // Ordered top to bottom by array position — see league.ts (shared) for why
  // there's no separate tier-number field.
  tiers: Types.ObjectId[];
  rules: LeagueSystemRules;
}

export interface LeagueSystemDocument extends LeagueSystemAttrs, Document {}

const leagueSystemRulesSchema = new Schema<LeagueSystemRules>(
  {
    promote_count: { type: Number, required: true, min: 0 },
    relegate_count: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const leagueSystemSchema = new Schema<LeagueSystemDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    scope: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    tiers: {
      type: [{ type: Schema.Types.ObjectId, ref: "Competition" }],
      default: [],
    },
    rules: {
      type: leagueSystemRulesSchema,
      required: true,
    },
  },
  withBaseOptions<LeagueSystemDocument>(),
);

leagueSystemSchema.index({ organization_id: 1, name: 1 }, { unique: true });

export const LeagueSystem = model<LeagueSystemDocument>("LeagueSystem", leagueSystemSchema);
