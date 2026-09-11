import { Router } from "express";
import {
  addToRoster,
  createTeam,
  deleteTeam,
  getPublicRoster,
  getPublicTeam,
  getTeam,
  getTeamSeasonStats,
  listPublicTeams,
  listRoster,
  listTeams,
  removeFromRoster,
  updateTeam,
} from "../controllers/team.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR33, public: registered before router.use(authenticate) below — same
// ordering reason as organizations'/competitions' "/public" routes.
// "/public" (one segment) is also registered before "/:teamId" (also one
// segment, gated) further down.
router.get("/public", asyncHandler(listPublicTeams));

// FR35, public — a fan-facing team page. Two segments, so there's no
// ordering conflict with "/public" or the gated "/:teamId" below either way.
router.get("/:teamId/public", asyncHandler(getPublicTeam));
router.get("/:teamId/season-stats", asyncHandler(getTeamSeasonStats));
router.get("/:teamId/roster/public", asyncHandler(getPublicRoster));

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
