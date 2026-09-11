import { Router } from "express";
import {
  createPlayer,
  deletePlayer,
  getPlayer,
  getPlayerSeasonStats,
  getPublicPlayer,
  listPlayers,
  updatePlayer,
} from "../controllers/player.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR35, public: registered before router.use(authenticate) below — same
// ordering reasoning as teams'/organizations'/competitions' public routes.
// Two segments, so no conflict with the gated "/:playerId" below either way.
router.get("/:playerId/public", asyncHandler(getPublicPlayer));
router.get("/:playerId/season-stats", asyncHandler(getPlayerSeasonStats));

// FR20: managing player rosters starts with the player records themselves,
// gated behind the same roster.manage permission.
router.use(authenticate, requirePermission("roster.manage"));

router.post("/", asyncHandler(createPlayer));
router.get("/", asyncHandler(listPlayers));
router.get("/:playerId", asyncHandler(getPlayer));
router.patch("/:playerId", asyncHandler(updatePlayer));
router.delete("/:playerId", asyncHandler(deletePlayer));

export default router;
