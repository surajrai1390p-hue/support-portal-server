/**
 * Authentication-related type definitions.
 *
 * Shared types used for session token encoding/decoding and role-based
 * access control across the application.
 */

/** Supported user roles within the support portal. */
export type Role = "Customer" | "Support";

/**
 * Shape of the decoded JWT session payload.
 *
 * Stored in the database session collection and also attached to
 * `req.session` by the authentication middleware for downstream use.
 */
export type SessionPayload = {
  /** Unique identifier of the authenticated user. */
  userId: string;
  /** Role that determines the user's permission level. */
  role: Role;
  /** Email address of the authenticated user. */
  email: string;
};