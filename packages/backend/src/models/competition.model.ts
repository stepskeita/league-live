import { COMPETITION_FORMATS, type CompetitionFormat } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface CompetitionFormatAttrs {
  type: CompetitionFormat;
  config: Record<string, unknown>;
}

export interface CompetitionAttrs {
  organization_id: Types.ObjectId;
  name: string;
  category: string;
  format: CompetitionFormatAttrs;
  ruleset: Record<string, unknown>;
  season: string;
}

export interface CompetitionDocument extends CompetitionAttrs, Document {}

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const competitionFormatSchema = new Schema<CompetitionFormatAttrs>(
  {
    type: {
      type: String,
      required: true,
      enum: COMPETITION_FORMATS,
    },
    config: {
      type: Schema.Types.Mixed,
      default: () => ({}),
      validate: { validator: isPlainObject, message: "format.config must be an object" },
    },
  },
  { _id: false },
);

const competitionSchema = new Schema<CompetitionDocument>(
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
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    format: {
      type: competitionFormatSchema,
      required: true,
    },
    // FR15: standings rules, configurable per competition, not hardcoded.
    // Overridable default so callers aren't forced to specify a full
    // ruleset from scratch for the common case.
    ruleset: {
      type: Schema.Types.Mixed,
      default: () => ({
        points: { win: 3, draw: 1, loss: 0 },
        tiebreakers: ["points", "goal_difference", "goals_for"],
      }),
      validate: { validator: isPlainObject, message: "ruleset must be an object" },
    },
    season: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 20,
    },
  },
  withBaseOptions<CompetitionDocument>(),
);

export const Competition = model<CompetitionDocument>("Competition", competitionSchema);
