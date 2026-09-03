import { Router } from "express";
import { getAuditLogEntry, listAuditLogEntries } from "../controllers/audit-log.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(authenticate, requirePermission("audit.view"));

// FR11: append only — intentionally no POST/PATCH/DELETE routes here at all.
router.get("/", asyncHandler(listAuditLogEntries));
router.get("/:entryId", asyncHandler(getAuditLogEntry));

export default router;
