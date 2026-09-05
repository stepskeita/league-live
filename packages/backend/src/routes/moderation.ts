import { Router } from "express";
import {
  getAnomalyFlag,
  getPlayerDisciplinaryRecord,
  listAnomalyFlags,
  listDisciplinaryRecords,
  resolveAnomalyFlag,
} from "../controllers/moderation.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR40/FR41, all gated behind results.verify.
router.use(authenticate, requirePermission("results.verify"));

// FR40: a review queue of system-flagged anomalies — no create route, since
// these are system generated, not user reported (see anomaly-flag.service.ts).
router.get("/flags", asyncHandler(listAnomalyFlags));
router.get("/flags/:flagId", asyncHandler(getAnomalyFlag));
router.post("/flags/:flagId/resolve", asyncHandler(resolveAnomalyFlag));

// FR41: disciplinary records, per player, for one Competition (which itself
// spans exactly one season).
router.get("/competitions/:competitionId/discipline", asyncHandler(listDisciplinaryRecords));
router.get("/competitions/:competitionId/discipline/:playerId", asyncHandler(getPlayerDisciplinaryRecord));

export default router;
