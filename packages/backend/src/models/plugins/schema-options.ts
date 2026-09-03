import type { SchemaOptions, Types } from "mongoose";

/**
 * Shared base options for every model: adds createdAt/updatedAt, and makes
 * toJSON() output an "id" string (matching docs/SRS.md's data model) instead
 * of Mongoose's raw _id/__v. `omit` drops additional fields that should never
 * leave the server (e.g. a User's password_hash), as defense in depth on top
 * of `select: false` on the field itself. `timestamps` defaults to true; pass
 * false for a model that tracks its own explicit timestamp instead (e.g. an
 * append-only AuditLogEntry, where "updatedAt" doesn't mean anything).
 */
export function withBaseOptions<DocType>(omit: string[] = [], timestamps = true): SchemaOptions<DocType> {
  return {
    timestamps,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        // Mongoose's generic conditional types for `ret` don't resolve inside
        // a generic helper like this one, so assert the shape we know is true
        // at runtime: every document has an ObjectId `_id`.
        const { _id, ...rest } = ret as unknown as { _id: Types.ObjectId } & Record<string, unknown>;
        for (const key of omit) {
          delete rest[key];
        }
        return { id: _id.toString(), ...rest };
      },
    },
  };
}
