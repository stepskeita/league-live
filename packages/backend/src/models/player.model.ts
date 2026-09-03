import { PLAYER_POSITIONS, type PlayerPosition } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface PlayerAttrs {
  organization_id: Types.ObjectId;
  team_id: Types.ObjectId;
  name: string;
  position: PlayerPosition;
  date_of_birth: Date;
}

export interface PlayerDocument extends PlayerAttrs, Document {}

const playerSchema = new Schema<PlayerDocument>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    position: {
      type: String,
      required: true,
      enum: PLAYER_POSITIONS,
    },
    date_of_birth: {
      type: Date,
      required: true,
      validate: {
        validator: (value: Date) => value.getTime() < Date.now(),
        message: "date_of_birth must be in the past",
      },
    },
  },
  withBaseOptions<PlayerDocument>(),
);

export const Player = model<PlayerDocument>("Player", playerSchema);
