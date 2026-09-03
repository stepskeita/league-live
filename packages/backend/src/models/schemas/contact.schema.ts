import type { Contact } from "@leaguelive/shared";
import { Schema } from "mongoose";

export const contactSchema = new Schema<Contact>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);
