import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface ClubAttrs {
  organization_id: Types.ObjectId;
  name: string;
}

export interface ClubDocument extends ClubAttrs, Document {}

const clubSchema = new Schema<ClubDocument>(
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
  },
  withBaseOptions<ClubDocument>(),
);

export const Club = model<ClubDocument>("Club", clubSchema);
