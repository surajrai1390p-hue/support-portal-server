/**
 * @file Support-user management route definition.
 *
 * Exposes a single POST endpoint for creating support (staff) user accounts.
 * Mounted at `/support` in the application bootstrap.
 */

import { Router } from "express";
import { createSupportUserHandler } from "../controllers/support.controller";

/** Express router instance for support-user operations. */
const router = Router();

router.post("/", createSupportUserHandler);

export default router;