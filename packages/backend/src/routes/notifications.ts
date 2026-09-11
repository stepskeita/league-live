import { Router } from "express";
import { getVapidPublicKey, subscribe, unsubscribe } from "../controllers/notification.controller";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// FR36, entirely public — there's no sign-in on the fan-facing apps this
// serves (fan-web, fan-app), so a subscription is identified by its own
// push endpoint, not an authenticated user.
router.get("/vapid-public-key", asyncHandler(getVapidPublicKey));
router.post("/subscribe", asyncHandler(subscribe));
router.post("/unsubscribe", asyncHandler(unsubscribe));

export default router;
