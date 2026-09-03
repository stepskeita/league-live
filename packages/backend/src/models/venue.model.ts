import type { Location } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";
import { locationSchema } from "./schemas/location.schema";

export interface VenueAttrs {
  organization_id: Types.ObjectId;
  name: string;
  location: Location;
}

export interface VenueDocument extends VenueAttrs, Document {}

const venueSchema = new Schema<VenueDocument>(
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
    location: {
      type: locationSchema,
      required: true,
    },
  },
  withBaseOptions<VenueDocument>(),
);

export const Venue = model<VenueDocument>("Venue", venueSchema);
