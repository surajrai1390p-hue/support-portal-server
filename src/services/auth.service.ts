/**
 * @fileoverview Authentication service — business logic for user login, session
 * management, and logout. Provides credential verification against the database,
 * JWT-based session signing, and cookie configuration helpers.
 *
 * @module auth.service
 */

import bcrypt from "bcrypt";
import { connectDB } from "../config/db";
import User from "../models/user";
import { signSession, usernameQuery } from "../utils/auth";
import { AppError } from "../utils/AppError";
import { Role } from "../interfaces/auth.interface";
import { SESSION_COOKIE, SESSION_EXPIRY, EMAIL_REGEX } from "../constants";

// Start the database connection as soon as this service loads so the first
// login never races a cold connection. loginUser also awaits connectDB(),
// which is safe because connectDB caches its in-flight promise.
connectDB().catch((err) =>
  console.error("[auth.service] DB connect failed:", (err as Error).message)
);

export type LoginResult = {
  token: string;
  role: string;
  user: { id: unknown; username: string; email: string };
};

/**
 * Returns cookie configuration for the session token.
 *
 * @param {number} maxAge - Maximum cookie lifetime in milliseconds.
 * @returns {object} Cookie options object compatible with Express / Set-Cookie.
 */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export { SESSION_COOKIE, SESSION_EXPIRY };

/**
 * Authenticates a user with email/username and password.
 *
 * Accepts a username or email. The client may send the matching field, but the
 * login UI presents a single "Username / Email" input, so the function falls
 * back: a non-email string sent under `email` is treated as a username. Emails
 * are matched case-insensitively; usernames match exactly.
 *
 * @async
 * @param {{ email?: string; username?: string }} credentials - Login identifier.
 * @param {string} password - Plain-text password to verify.
 * @returns {Promise<LoginResult>} A signed session token, role, and basic user info.
 * @throws {AppError} 400 if credentials are missing or malformed.
 * @throws {AppError} 401 if no matching active user is found or the password is incorrect.
 */
export async function loginUser(
  credentials: { email?: string; username?: string },
  password: string
): Promise<LoginResult> {
  const rawEmail = credentials.email?.trim();
  const rawUsername = credentials.username?.trim();

  const email = rawEmail && EMAIL_REGEX.test(rawEmail) ? rawEmail.toLowerCase() : undefined;
  const username = rawUsername || (rawEmail && !email ? rawEmail : undefined);

  if ((!email && !username) || !password) {
    throw new AppError(400, "Username/Email and password are required");
  }

  await connectDB();

  const query = email
    ? { email }
    : usernameQuery(username as string);

  const user = await User.findOne(query);
  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid credentials");
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    throw new AppError(401, "Invalid credentials");
  }

  const token = await signSession({
    userId: String(user._id),
    role: user.role as Role,
    email: user.email,
  });

  return {
    token,
    role: user.role,
    user: { id: user._id, username: user.Username, email: user.email },
  };
}