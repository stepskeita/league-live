import type { Location } from "@leaguelive/shared";
import { Schema } from "mongoose";

export const locationSchema = new Schema<Location>(
  {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false },
);
