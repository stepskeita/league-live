import { Router } from "express";
import {
  assignReporter,
  confirmResult,
  createFixture,
  deleteFixture,
  endMatchSession,
  getFixture,
  getFixtureContext,
  getFixtureLiveState,
  listFixtures,
  listLiveFixtures,
  myAssignedFixtures,
  startMatchSession,
  unassignReporter,
  updateFixture,
} from "../controllers/fixture.controller";
import {
  createMatchEvent,
  deleteMatchEvent,
  listMatchEvents,
  updateMatchEvent,
} from "../controllers/match-event.controller";
import { authenticate } from "../middleware/authenticate";
import { requireAnyPermission, requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR30/FR32, public: no authenticate() at all. Registered before
// router.use(authenticate) below — Express tries routes in registration
// order and stops at the first match, so a request matching these specific
// paths never reaches it. "/live" (one segment) is also registered here,
// before "/:fixtureId" (also one segment, admin-gated) further down — same
// ordering reason "/mine" is registered before "/:fixtureId".
router.get("/live", asyncHandler(listLiveFixtures));
router.get("/:fixtureId/live", asyncHandler(getFixtureLiveState));

// Everything else: permissions differ by route (scheduling is fixture.manage,
// reporter assignment is reporter.assign, match reporting is match.report,
// confirming a result is results.verify, and FR24's "my assigned fixtures"
// needs no permission beyond being authenticated), so requirePermission is
// applied per route rather than once alongside authenticate.
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

// The one read a reporter's own app needs to show more than raw ids —
// resolved Team names for the fixture's two sides. Same dual-audience gate
// and resolution as the events GET below.
router.get(
  "/:fixtureId/context",
  requireAnyPermission("match.report", "results.verify"),
  asyncHandler(getFixtureContext),
);

// FR26/FR27: live event logging, idempotent on a client generated event id.
// The GET is shared with FR39's verifier review — see
// match-event.service.ts's listMatchEvents for how the two audiences are
// authorized differently once past this gate.
router.get(
  "/:fixtureId/events",
  requireAnyPermission("match.report", "results.verify"),
  asyncHandler(listMatchEvents),
);
router.post("/:fixtureId/events", requirePermission("match.report"), asyncHandler(createMatchEvent));

// FR39: a verifier reviewing and correcting events before the result is
// locked — deliberately a different permission from match.report (the
// reporter who logs events isn't necessarily who reviews them), org-scoped
// rather than assigned-reporter-scoped like the routes above.
router.patch("/:fixtureId/events/:eventId", requirePermission("results.verify"), asyncHandler(updateMatchEvent));
router.delete("/:fixtureId/events/:eventId", requirePermission("results.verify"), asyncHandler(deleteMatchEvent));

// FR28: locks the official result. Deliberately a different permission from
// match.report — the reporter who covered the match and whoever confirms
// its official result don't have to be the same person.
router.post("/:fixtureId/confirm", requirePermission("results.verify"), asyncHandler(confirmResult));

export default router;
