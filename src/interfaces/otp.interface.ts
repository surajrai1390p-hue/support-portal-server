/**
 * OTP (One-Time Password) type definitions.
 *
 * Describes the shape of entries stored in the in-memory OTP store and
 * rate limiter used for email / phone verification flows.
 */

/**
 * A single OTP record in the in-memory store.
 *
 * Each entry represents an OTP code that has been generated for a
 * specific destination (email or phone) and tracks verification state.
 */
export type OtpEntry = {
  /** The generated OTP code. */
  otp: string;
  /** Unix timestamp (ms) at which the OTP expires. */
  expiresAt: number;
  /** Number of incorrect verification attempts made so far. */
  attempts: number;
  /** Whether the OTP has been successfully verified. */
  verified?: boolean;
};

/**
 * Rate-limiting record for OTP requests to a single destination.
 *
 * Tracks how many OTP requests have been made within the current window
 * and when the destination will be unblocked after exceeding the limit.
 */
export type OtpRateEntry = {
  /** Number of OTP requests made in the current window. */
  count: number;
  /** Unix timestamp (ms) after which the destination is no longer blocked. */
  blockedUntil: number;
  /** Unix timestamp (ms) of the last request in the current window. */
  updatedAt: number;
};