import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface TeamAttrs {
  organization_id: Types.ObjectId;
  club_id: Types.ObjectId;
  name: string;
  category: string;
  venue_id: Types.ObjectId | null;
}

export interface TeamDocument extends TeamAttrs, Document {}

const teamSchema = new Schema<TeamDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    club_id: {
      type: Schema.Types.ObjectId,
      ref: "Club",
      required: true,
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
    venue_id: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      default: null,
    },
  },
  withBaseOptions<TeamDocument>(),
);

export const Team = model<TeamDocument>("Team", teamSchema);
