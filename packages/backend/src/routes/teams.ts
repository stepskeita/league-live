import { Router } from "express";
import {
  addToRoster,
  createTeam,
  deleteTeam,
  getTeam,
  listRoster,
  listTeams,
  removeFromRoster,
  updateTeam,
} from "../controllers/team.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR16: register teams. FR20: manage a team's player roster per season —
// both gated behind roster.manage.
router.use(authenticate, requirePermission("roster.manage"));

router.post("/", asyncHandler(createTeam));
router.get("/", asyncHandler(listTeams));
router.get("/:teamId", asyncHandler(getTeam));
router.patch("/:teamId", asyncHandler(updateTeam));
router.delete("/:teamId", asyncHandler(deleteTeam));

router.get("/:teamId/roster", asyncHandler(listRoster));
router.post("/:teamId/roster", asyncHandler(addToRoster));
router.delete("/:teamId/roster/:entryId", asyncHandler(removeFromRoster));

export default router;
