import { Router } from "express";
import {
  assignReporter,
  confirmResult,
  createFixture,
  deleteFixture,
  endMatchSession,
  getFixture,
  listFixtures,
  myAssignedFixtures,
  startMatchSession,
  unassignReporter,
  updateFixture,
} from "../controllers/fixture.controller";
import { createMatchEvent, listMatchEvents } from "../controllers/match-event.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// Unlike most resource routers, permissions here differ by route: scheduling
// (fixture.manage), reporter assignment (reporter.assign), match reporting
// (match.report) and confirming a result (results.verify) are all separate
// capabilities, and FR24's "my assigned fixtures" needs no permission beyond
// being authenticated. So requirePermission is applied per route rather than
// once via router.use().
router.use(authenticate);

// FR24: must come before "/:fixtureId" or Express would match "mine" as an id.
router.get("/mine", asyncHandler(myAssignedFixtures));

router.post("/", requirePermission("fixture.manage"), asyncHandler(createFixture));
router.get("/", requirePermission("fixture.manage"), asyncHandler(listFixtures));
router.get("/:fixtureId", requirePermission("fixture.manage"), asyncHandler(getFixture));
router.patch("/:fixtureId", requirePermission("fixture.manage"), asyncHandler(updateFixture));
router.delete("/:fixtureId", requirePermission("fixture.manage"), asyncHandler(deleteFixture));

router.put("/:fixtureId/reporter", requirePermission("reporter.assign"), asyncHandler(assignReporter));
router.delete("/:fixtureId/reporter", requirePermission("reporter.assign"), asyncHandler(unassignReporter));

// FR25: match session start/end. match.report gets a caller in the door;
// fixture.service.ts's requireAssignedReporter is the actual data-layer
// check that it's *their* assigned fixture, not just any fixture.manage
// holder's.
router.post("/:fixtureId/start", requirePermission("match.report"), asyncHandler(startMatchSession));
router.post("/:fixtureId/end", requirePermission("match.report"), asyncHandler(endMatchSession));

// FR26/FR27: live event logging, idempotent on a client generated event id.
router.get("/:fixtureId/events", requirePermission("match.report"), asyncHandler(listMatchEvents));
router.post("/:fixtureId/events", requirePermission("match.report"), asyncHandler(createMatchEvent));

// FR28: locks the official result. Deliberately a different permission from
// match.report — the reporter who covered the match and whoever confirms
// its official result don't have to be the same person.
router.post("/:fixtureId/confirm", requirePermission("results.verify"), asyncHandler(confirmResult));

export default router;
