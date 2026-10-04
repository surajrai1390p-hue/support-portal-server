/**
 * Auth Controller
 *
 * Handles user authentication HTTP endpoints. Delegates business logic to the
 * auth service layer. Manages session cookies for stateless JWT-based auth.
 *
 * @module controllers/auth
 */

import { Request, Response } from "express";
import {
  loginUser,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "../services/auth.service";
import { verifySession } from "../utils/auth";
import { SESSION_MAX_AGE_MS } from "../constants";
import { successResponse, failureResponse } from "../utils/response";
import { AppError } from "../utils/AppError";

/**
 * Authenticates a user by email/username and password.
 *
 * Accepts credentials via JSON body or HTTP Basic Authorization header.
 * On success, sets a session cookie and returns the user's role and profile.
 *
 * @param req - Express request. Body may contain `email`, `username`, `password`, or use `Authorization: Basic` header.
 * @param res - Express response. Sets session cookie on success.
 * @returns JSON success response with `{ role, user }` or error response.
 */
export async function loginHandler(req: Request, res: Response) {
  try {
    let { email, username, password } = req.body || {};
  

    if (!password && req.headers.authorization?.startsWith("Basic ")) {
      const decoded = Buffer.from(
        req.headers.authorization.split(" ")[1],
        "base64"
      ).toString();
      const [identifier, pass] = decoded.split(":");
      password = pass;
      if (identifier.includes("@")) email = identifier;
      else username = identifier;
    }
  

    const authHeader = req.headers.authorization || "none";
    console.log("[Login] Authorization header:", authHeader);

    const result = await loginUser(
      {
        email: email ? String(email).trim() : undefined,
        username: username ? String(username).trim() : undefined,
      },
      password
    );


    res.cookie(
      SESSION_COOKIE,
      result.token,
      sessionCookieOptions(SESSION_MAX_AGE_MS),
    );

    return successResponse(res, "Login successful", {
      role: result.role,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Login error:", error);
    return failureResponse(res, "Login failed", 500);
  }
}

/**
 * Returns the currently authenticated user's profile.
 *
 * Reads the session cookie and verifies the JWT. Returns `{ user: null }`
 * when no valid session exists.
 *
 * @param req - Express request with session cookie.
 * @param res - Express response.
 * @returns JSON response with `{ user: { id, email, role } }` or `{ user: null }`.
 */
export async function getMeHandler(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? await verifySession(token) : null;

  if (!session) return successResponse(res, "OK", { user: null });

  return successResponse(res, "OK", {
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
    },
  });
}

/**
 * Clears the session cookie to log the user out.
 *
 * Idempotent — always returns 200 regardless of current auth state.
 *
 * @param _req - Express request (unused).
 * @param res - Express response. Clears the session cookie.
 * @returns JSON success response.
 */
export async function logoutHandler(_req: Request, res: Response) {
  res.cookie(SESSION_COOKIE, "", sessionCookieOptions(0));
  return successResponse(res, "Logged out", {});
}
