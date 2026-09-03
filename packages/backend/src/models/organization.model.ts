import { ORGANIZATION_TYPES, type Contact, type OrganizationType } from "@leaguelive/shared";
import { Schema, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";
import { contactSchema } from "./schemas/contact.schema";

export interface OrganizationAttrs {
  name: string;
  type: OrganizationType;
  country: string | null;
  confederation: string | null;
  contact: Contact;
}

export interface OrganizationDocument extends OrganizationAttrs, Document {}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    type: {
      type: String,
      required: true,
      enum: ORGANIZATION_TYPES,
    },
    country: {
      type: String,
      trim: true,
      default: null,
    },
    confederation: {
      type: String,
      trim: true,
      default: null,
    },
    contact: {
      type: contactSchema,
      required: true,
    },
  },
  withBaseOptions<OrganizationDocument>(),
);

export const Organization = model<OrganizationDocument>("Organization", organizationSchema);
