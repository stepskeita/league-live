import { Router } from "express";
import { createPlayer, deletePlayer, getPlayer, listPlayers, updatePlayer } from "../controllers/player.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR20: managing player rosters starts with the player records themselves,
// gated behind the same roster.manage permission.
router.use(authenticate, requirePermission("roster.manage"));

router.post("/", asyncHandler(createPlayer));
router.get("/", asyncHandler(listPlayers));
router.get("/:playerId", asyncHandler(getPlayer));
router.patch("/:playerId", asyncHandler(updatePlayer));
router.delete("/:playerId", asyncHandler(deletePlayer));

export default router;
