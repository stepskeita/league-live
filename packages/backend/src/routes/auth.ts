import { Router } from "express";
import { login, logout, me, myPermissions, refresh, signup } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(me));
router.get("/me/permissions", authenticate, asyncHandler(myPermissions));

export default router;
