import { Router } from "express";
import {
  assignReporter,
  createFixture,
  deleteFixture,
  getFixture,
  listFixtures,
  myAssignedFixtures,
  unassignReporter,
  updateFixture,
} from "../controllers/fixture.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// Unlike most resource routers, permissions here differ by route: scheduling
// (fixture.manage) and reporter assignment (reporter.assign) are separate
// FR18/FR19 capabilities, and FR24's "my assigned fixtures" needs no
// permission beyond being authenticated. So requirePermission is applied
// per route rather than once via router.use().
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

export default router;
