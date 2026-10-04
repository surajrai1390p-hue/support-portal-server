/**
 * @file Authentication route definitions.
 *
 * Exposes the public login endpoint and the authenticated `/me` and `/logout`
 * endpoints. Mounted at `/auth` in the application bootstrap.
 */

import { Router } from "express";
import {
  loginHandler,
  getMeHandler,
  logoutHandler,
} from "../controllers/auth.controller";

/** Express router instance for auth-related routes. */
const router = Router();

router.post("/login", loginHandler);


router.get("/me", getMeHandler);
router.post("/logout", logoutHandler);

export default router;