import { PERMISSION_KEYS, type PermissionKey } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface RoleAttrs {
  // Null means the role is platform scoped (applies across every
  // Organization) rather than tied to one — see docs/SRS.md section 7.
  organization_id: Types.ObjectId | null;
  name: string;
  permission_keys: PermissionKey[];
}

export interface RoleDocument extends RoleAttrs, Document {}

const roleSchema = new Schema<RoleDocument>(
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
      maxlength: 100,
    },
    permission_keys: {
      type: [{ type: String, enum: PERMISSION_KEYS }],
      default: [],
      validate: {
        validator: (keys: string[]) => new Set(keys).size === keys.length,
        message: "permission_keys must not contain duplicates",
      },
    },
  },
  withBaseOptions<RoleDocument>(),
);

// A role's name only needs to be unique within its own scope (organization,
// or the platform scope when organization_id is null).
roleSchema.index({ organization_id: 1, name: 1 }, { unique: true });

export const Role = model<RoleDocument>("Role", roleSchema);
