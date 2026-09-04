import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface CompetitionEntryAttrs {
  // The Competition's owning Organization — not necessarily the Team's
  // (FR17: a competition can draw in teams from other Organizations).
  organization_id: Types.ObjectId;
  competition_id: Types.ObjectId;
  team_id: Types.ObjectId;
}

export interface CompetitionEntryDocument extends CompetitionEntryAttrs, Document {}

const competitionEntrySchema = new Schema<CompetitionEntryDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    competition_id: {
      type: Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
    },
    team_id: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
  },
  withBaseOptions<CompetitionEntryDocument>(),
);

competitionEntrySchema.index({ competition_id: 1, team_id: 1 }, { unique: true });

export const CompetitionEntry = model<CompetitionEntryDocument>("CompetitionEntry", competitionEntrySchema);
