import type { Contact } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";
import { contactSchema } from "./schemas/contact.schema";

export interface UserAttrs {
  // Nullable only here: a Platform Operator is not scoped to any Organization.
  organization_id: Types.ObjectId | null;
  name: string;
  contact: Contact;
  password_hash: string;
}

export interface UserDocument extends UserAttrs, Document {}

const userSchema = new Schema<UserDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    contact: {
      type: contactSchema,
      required: true,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
  },
  withBaseOptions<UserDocument>(["password_hash"]),
);

userSchema.index({ "contact.email": 1 }, { unique: true });

export const User = model<UserDocument>("User", userSchema);
