import { Router } from "express";
import {
  assignRole,
  createRole,
  deleteRole,
  getRole,
  listRoleAssignments,
  listRoles,
  unassignRole,
  updateRole,
} from "../controllers/role.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(authenticate, requirePermission("role.manage"));

router.post("/", asyncHandler(createRole));
router.get("/", asyncHandler(listRoles));
router.get("/:roleId", asyncHandler(getRole));
router.patch("/:roleId", asyncHandler(updateRole));
router.delete("/:roleId", asyncHandler(deleteRole));

router.post("/:roleId/assignments", asyncHandler(assignRole));
router.get("/:roleId/assignments", asyncHandler(listRoleAssignments));
router.delete("/:roleId/assignments/:userId", asyncHandler(unassignRole));

export default router;
