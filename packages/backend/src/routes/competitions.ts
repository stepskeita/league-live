import { Router } from "express";
import {
  addCompetitionEntry,
  createCompetition,
  deleteCompetition,
  getCompetition,
  getCompetitionStandings,
  listCompetitionEntries,
  listCompetitions,
  removeCompetitionEntry,
  updateCompetition,
} from "../controllers/competition.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR31/FR34, public: registered before router.use(authenticate) below —
// Express tries routes in registration order and stops at the first match,
// so a request matching this specific path never reaches it.
router.get("/:competitionId/standings", asyncHandler(getCompetitionStandings));

// FR13/FR14/FR15: create/configure competitions. FR17: manage which Teams
// are entered — both gated behind competition.manage.
router.use(authenticate, requirePermission("competition.manage"));

router.post("/", asyncHandler(createCompetition));
router.get("/", asyncHandler(listCompetitions));
router.get("/:competitionId", asyncHandler(getCompetition));
router.patch("/:competitionId", asyncHandler(updateCompetition));
router.delete("/:competitionId", asyncHandler(deleteCompetition));

router.get("/:competitionId/entries", asyncHandler(listCompetitionEntries));
router.post("/:competitionId/entries", asyncHandler(addCompetitionEntry));
router.delete("/:competitionId/entries/:entryId", asyncHandler(removeCompetitionEntry));

export default router;
