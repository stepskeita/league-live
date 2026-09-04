import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface RosterEntryAttrs {
  organization_id: Types.ObjectId;
  team_id: Types.ObjectId;
  player_id: Types.ObjectId;
  season: string;
}

export interface RosterEntryDocument extends RosterEntryAttrs, Document {}

const rosterEntrySchema = new Schema<RosterEntryDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    team_id: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    player_id: {
      type: Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    season: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 20,
    },
  },
  withBaseOptions<RosterEntryDocument>(),
);

rosterEntrySchema.index({ team_id: 1, player_id: 1, season: 1 }, { unique: true });

export const RosterEntry = model<RosterEntryDocument>("RosterEntry", rosterEntrySchema);
