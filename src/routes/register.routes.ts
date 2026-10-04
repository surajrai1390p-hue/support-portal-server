/**
 * @file User registration route definition.
 *
 * Exposes a single public POST endpoint for new user registration.
 * Mounted at `/register` in the application bootstrap.
 */

import { Router } from "express";
import { registerHandler } from "../controllers/register.controller";

/** Express router instance for user registration. */
const router = Router();

router.post("/", registerHandler);

export default router;