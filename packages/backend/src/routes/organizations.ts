import { Router } from "express";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} from "../controllers/organization.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR1/FR2: onboarding and cross-Organization management is Platform Operator
// territory — organization.manage is a platform scoped permission (see
// packages/shared/src/types/permission.ts), never seeded into an
// Organization's own default roles.
router.use(authenticate, requirePermission("organization.manage"));

router.post("/", asyncHandler(createOrganization));
router.get("/", asyncHandler(listOrganizations));
router.get("/:organizationId", asyncHandler(getOrganization));
router.patch("/:organizationId", asyncHandler(updateOrganization));

export default router;
