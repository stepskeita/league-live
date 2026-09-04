import { Router } from "express";
import {
  createLeagueSystem,
  deleteLeagueSystem,
  endSeason,
  getLeagueSystem,
  listLeagueSystems,
  setTiers,
  updateLeagueSystem,
} from "../controllers/league-system.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR21: defining a League System, and FR22/FR23's "end season" action, are
// both gated behind competition.manage.
router.use(authenticate, requirePermission("competition.manage"));

router.post("/", asyncHandler(createLeagueSystem));
router.get("/", asyncHandler(listLeagueSystems));
router.get("/:leagueSystemId", asyncHandler(getLeagueSystem));
router.patch("/:leagueSystemId", asyncHandler(updateLeagueSystem));
router.delete("/:leagueSystemId", asyncHandler(deleteLeagueSystem));

router.put("/:leagueSystemId/tiers", asyncHandler(setTiers));

// Deliberately no scheduled job or automatic trigger anywhere in this
// codebase — the platform has no reliable way to know a season is over, so
// this is always a manually triggered admin action (per the brief; see
// league-system.service.ts's endSeason for the full reasoning).
router.post("/:leagueSystemId/end-season", asyncHandler(endSeason));

export default router;
