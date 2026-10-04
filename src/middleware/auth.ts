/**
 * Authentication middleware.
 *
 * Extracts the session cookie from the incoming request, verifies it,
 * and attaches the decoded {@link SessionPayload} to `req.session`. If
 * verification fails or the cookie is missing, the request is rejected
 * with a 401 response.
 */

import { Request, Response, NextFunction } from "express";
import { verifySession } from "../utils/auth";
import { SessionPayload } from "../interfaces/auth.interface";
import { SESSION_COOKIE } from "../constants";

/**
 * Express middleware that enforces authentication.
 *
 * The middleware reads the JWT session token from the cookie named
 * {@link SESSION_COOKIE}, verifies it using {@link verifySession}, and
 * populates `req.session` with the decoded payload. Routes mounted
 * after this middleware can safely assume `req.session` is populated.
 *
 * @param req  - The incoming Express request.
 * @param res  - The Express response object, used to send a 401 if
 *               authentication fails.
 * @param next - Callback to pass control to the next middleware.
 * @returns A 401 JSON response when the session is invalid or missing;
 *          otherwise calls `next()`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session: SessionPayload | null = token
    ? await verifySession(token)
    : null;
  req.session = session;
  if (!session) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized" });
  }
  next();
}