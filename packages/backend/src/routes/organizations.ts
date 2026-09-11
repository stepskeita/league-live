import { Router } from "express";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  listPublicOrganizations,
  updateOrganization,
} from "../controllers/organization.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR33, public: registered before router.use(authenticate) below — Express
// tries routes in registration order and stops at the first match, so a
// request for this specific path never reaches it. "/public" (one segment)
// is also registered here before "/:organizationId" (also one segment,
// Platform Operator gated) further down, same ordering reason as fixtures'
// "/mine"/"/live".
router.get("/public", asyncHandler(listPublicOrganizations));

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
