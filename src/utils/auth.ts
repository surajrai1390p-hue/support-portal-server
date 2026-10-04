/**
 * @file JWT session helpers.
 *
 * Provides functions for issuing, verifying, and constructing queries around
 * the session JSON Web Token used to authenticate requests.
 */

import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env";
import { SessionPayload } from "../interfaces/auth.interface";
import { SESSION_EXPIRY } from "../constants";

/**
 * Encode the JWT secret from environment configuration into a Uint8Array
 * suitable for the `jose` signing/verification APIs.
 *
 * @returns UTF-8 encoded secret key.
 */
function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

/**
 * Issue a signed JWT containing the session payload (userId, role, email).
 *
 * @param payload - Session data to encode in the token.
 * @returns A signed JWT string.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(secretKey());
}

/**
 * Build an exact, case-sensitive Mongo query for the Username field so login
 * and uniqueness checks match only the username as it was registered.
 *
 * @param username - The username value to query.
 * @returns A Mongo filter object with the `Username` field.
 */
export function usernameQuery(username: string): { Username: string } {
  return { Username: username };
}

/**
 * Verify a JWT and return its decoded payload, or null if the token is
 * missing, expired, or otherwise invalid.
 *
 * @param token - The JWT string to verify.
 * @returns The decoded `SessionPayload` or `null` on failure.
 */
export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}