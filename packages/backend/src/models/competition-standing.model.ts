import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface CompetitionStandingAttrs {
  organization_id: Types.ObjectId;
  competition_id: Types.ObjectId;
  season: string;
  // Ordered CompetitionEntry refs, best to worst.
  entries: Types.ObjectId[];
}

export interface CompetitionStandingDocument extends CompetitionStandingAttrs, Document {}

function isNonEmpty(value: unknown[]): boolean {
  return value.length > 0;
}

const competitionStandingSchema = new Schema<CompetitionStandingDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
      immutable: true,
    },
    competition_id: {
      type: Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      immutable: true,
    },
    season: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 20,
      immutable: true,
    },
    entries: {
      type: [{ type: Schema.Types.ObjectId, ref: "CompetitionEntry" }],
      required: true,
      validate: { validator: isNonEmpty, message: "entries must not be empty" },
      immutable: true,
    },
  },
  withBaseOptions<CompetitionStandingDocument>(),
);

// A season's standings for one competition are locked once — see
// competition-standing.service equivalent logic in league-system.service.ts's
// endSeason, which checks for an existing one before creating another.
competitionStandingSchema.index({ competition_id: 1, season: 1 }, { unique: true });

export const CompetitionStanding = model<CompetitionStandingDocument>(
  "CompetitionStanding",
  competitionStandingSchema,
);
