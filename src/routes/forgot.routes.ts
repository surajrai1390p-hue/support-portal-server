/**
 * @file Forgot-password / account-recovery route definitions.
 *
 * Exposes a multi-step password reset flow: check email existence, request an
 * OTP, verify the OTP, and finally reset the password. All endpoints are
 * public (no authentication required). Mounted at `/forgot` in the
 * application bootstrap.
 */

import { Router } from "express";
import {
  checkEmailHandler,
  requestOtpHandler,
  verifyOtpHandler,
  resetPasswordHandler,
} from "../controllers/forgot.controller";

/** Express router instance for the forgot-password flow. */
const router = Router();

router.post("/check-email", checkEmailHandler);
router.post("/request", requestOtpHandler);
router.post("/verify", verifyOtpHandler);
router.post("/reset", resetPasswordHandler);

export default router;