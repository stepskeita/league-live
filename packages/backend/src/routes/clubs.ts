import { Router } from "express";
import { createClub, deleteClub, getClub, listClubs, updateClub } from "../controllers/club.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR16: a user with roster.manage can register club details.
router.use(authenticate, requirePermission("roster.manage"));

router.post("/", asyncHandler(createClub));
router.get("/", asyncHandler(listClubs));
router.get("/:clubId", asyncHandler(getClub));
router.patch("/:clubId", asyncHandler(updateClub));
router.delete("/:clubId", asyncHandler(deleteClub));

export default router;
