import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface UserRoleAttrs {
  user_id: Types.ObjectId;
  role_id: Types.ObjectId;
  // Denormalized from the referenced Role at assignment time, so tenant
  // scoped queries (e.g. "every assignment in this Organization") don't need
  // to join through Role. A Role's organization_id is immutable after
  // creation, so this can never drift.
  organization_id: Types.ObjectId | null;
}

export interface UserRoleDocument extends UserRoleAttrs, Document {}

const userRoleSchema = new Schema<UserRoleDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role_id: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
  },
  withBaseOptions<UserRoleDocument>(),
);

userRoleSchema.index({ user_id: 1, role_id: 1 }, { unique: true });

export const UserRole = model<UserRoleDocument>("UserRole", userRoleSchema);
