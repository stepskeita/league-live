import { AUDIT_ACTIONS, type AuditAction } from "@leaguelive/shared";
import {
  Schema,
  Types,
  model,
  type CallbackWithoutResultAndOptionalError,
  type Document,
  type MongooseDefaultQueryMiddleware,
} from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface AuditLogEntryAttrs {
  // The Organization whose data was affected — not necessarily the actor's
  // own Organization (a Platform Operator can act across every
  // Organization). Null for actions with no Organization scope.
  organization_id: Types.ObjectId | null;
  actor_user_id: Types.ObjectId;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  before?: unknown;
  after?: unknown;
  timestamp: Date;
}

export interface AuditLogEntryDocument extends AuditLogEntryAttrs, Document {}

// FR11: append only, no role (including Platform Operator) can edit or
// delete an entry. `immutable: true` stops a field from changing after
// insert; these query middleware hooks stop whole-document update/delete —
// belt and suspenders on top of there being no update/delete route at all.
const BLOCKED_QUERY_OPS: MongooseDefaultQueryMiddleware[] = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];

const auditLogEntrySchema = new Schema<AuditLogEntryDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
      immutable: true,
    },
    actor_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      immutable: true,
    },
    resource_type: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    resource_id: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    before: {
      type: Schema.Types.Mixed,
      immutable: true,
    },
    after: {
      type: Schema.Types.Mixed,
      immutable: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  withBaseOptions<AuditLogEntryDocument>([], false),
);

auditLogEntrySchema.index({ organization_id: 1, timestamp: -1 });

auditLogEntrySchema.pre(BLOCKED_QUERY_OPS, function blockMutation(next: CallbackWithoutResultAndOptionalError) {
  next(new Error("AuditLogEntry records are append only and cannot be updated or deleted."));
});

export const AuditLogEntry = model<AuditLogEntryDocument>("AuditLogEntry", auditLogEntrySchema);
