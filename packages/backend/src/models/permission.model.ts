/**
 * Permissions are a fixed, code defined catalog (docs/SRS.md FR4) — there is
 * no Mongoose model/collection here on purpose. Nothing can create, edit, or
 * delete a permission at runtime; the catalog only changes when a developer
 * adds a new key here alongside the check it guards. Role documents store
 * permission keys directly (validated against this catalog), not references
 * to persisted Permission documents.
 */
export { PERMISSIONS, PERMISSION_KEYS, type Permission, type PermissionKey } from "@leaguelive/shared";
