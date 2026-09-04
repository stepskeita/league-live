import { Router } from "express";
import { createVenue, deleteVenue, getVenue, listVenues, updateVenue } from "../controllers/venue.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR16: a user with roster.manage can register venues.
router.use(authenticate, requirePermission("roster.manage"));

router.post("/", asyncHandler(createVenue));
router.get("/", asyncHandler(listVenues));
router.get("/:venueId", asyncHandler(getVenue));
router.patch("/:venueId", asyncHandler(updateVenue));
router.delete("/:venueId", asyncHandler(deleteVenue));

export default router;
