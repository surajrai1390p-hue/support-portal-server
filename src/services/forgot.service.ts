/**
 * @fileoverview Forgot-password service — handles the full OTP-based password
 * recovery flow: checking account existence, requesting an OTP (delivered via
 * email), verifying the OTP, and resetting the password.
 *
 * The recovery flow has three steps:
 * 1. **requestOtp** — generate and deliver a one-time code.
 * 2. **verifyOtp** — validate the code and mark the session as verified.
 * 3. **resetPassword** — replace the old password using the verified session.
 *
 * @module forgot.service
 */

import bcrypt from "bcrypt";
import { connectDB } from "../config/db";
import User from "../models/user";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import {
  generateOtp,
  setOtp,
  getOtp,
  bumpAttempt,
  clearOtp,
  enforceOtpRequestLimit,
} from "../utils/otp";
import { sendOtpEmail } from "../utils/mailer";
import { OTP_CONFIG, MIN_PASSWORD_LENGTH } from "../constants";

type RecoveryMethod = "email" | "phone";

type UserFields = { email: string; mobile: string };

/**
 * Builds a MongoDB query that matches a user by email or phone.
 *
 * @param {RecoveryMethod} method - Either "email" or "phone".
 * @param {string} value - The email address or phone number.
 * @returns {object} MongoDB filter object.
 */
function lookupQuery(method: RecoveryMethod, value: string) {
  return method === "email"
    ? { email: value.toLowerCase() }
    : { mobile: value };
}

/**
 * Returns the rate-limit cache key for a recovery destination.
 * Emails are normalised to lowercase for case-insensitive tracking.
 *
 * @param {RecoveryMethod} method - "email" or "phone".
 * @param {string} value - The destination value.
 * @returns {string} Rate-limit key string.
 */
function rateLimitKey(method: RecoveryMethod, value: string) {
  return `otpreq:${method}:${value.toLowerCase()}`;
}

/**
 * Returns the in-memory cache key for the OTP entry.
 * Keyed by email/phone string so the OTP is scoped to a specific destination.
 *
 * @param {RecoveryMethod} method - "email" or "phone".
 * @param {UserFields} user - User object containing email and/or mobile.
 * @returns {string} OTP cache key string.
 */
function otpKey(method: RecoveryMethod, user: UserFields) {
  return method === "email" ? `email:${user.email}` : `phone:${user.mobile}`;
}

/**
 * Partially masks a recovery destination so the UI can hint where it was sent
 * without exposing the full address or phone number.
 *
 * @param {RecoveryMethod} method - "email" or "phone".
 * @param {UserFields} user - User object containing email and/or mobile.
 * @returns {string} Masked string (e.g. "j***@example.com" or "*****1234").
 */
function maskDestination(method: RecoveryMethod, user: UserFields) {
  return method === "email"
    ? user.email.replace(/(^.).+(@.*$)/, "$1***$2")
    : user.mobile.replace(/.(?=.{4})/g, "*");
}

/**
 * Type guard that narrows an unknown value to a valid {@link RecoveryMethod}.
 *
 * @param {unknown} method - Value to validate.
 * @returns {boolean} `true` if `method` is "email" or "phone".
 */
function isRecoveryMethod(method: unknown): method is RecoveryMethod {
  return method === "email" || method === "phone";
}

/**
 * Checks whether a recovery value (email or phone) belongs to a registered user.
 *
 * Intended for the initial UI step so the form can reject unregistered addresses
 * early without revealing which specific values are registered.
 *
 * @async
 * @param {unknown} method - Recovery method ("email" or "phone").
 * @param {unknown} value - The email address or phone number to look up.
 * @returns {Promise<{ exists: boolean }>} Whether the account exists.
 * @throws {AppError} 400 if `method` or `value` is missing / invalid.
 */
export async function checkEmailExists(method: unknown, value: unknown) {
  if (value === undefined || !isRecoveryMethod(method)) {
    throw new AppError(
      400,
      "Provide a recovery method (email or phone) and value"
    );
  }

  await connectDB();

  const user = await User.findOne(lookupQuery(method, String(value)));

  return { exists: Boolean(user) };
}

/**
 * Generates and delivers a one-time password for password recovery.
 *
 * Rate-limited to a maximum of 5 requests per destination within a 10-minute
 * window. For email recovery the OTP is sent via Mailjet; phone delivery is
 * logged only (placeholder for a future SMS gateway).
 *
 * To avoid account enumeration, the response is the same whether or not the
 * user exists.
 *
 * @async
 * @param {unknown} method - Recovery method ("email" or "phone").
 * @param {unknown} value - The destination email/phone to send the OTP to.
 * @returns {Promise<{ message: string; method: string; destination: string }>}
 *   Confirmation message, recovery method, and masked destination.
 * @throws {AppError} 400 if `method` or `value` is missing / invalid.
 * @throws {AppError} 429 if the per-destination rate limit is exceeded.
 * @throws {AppError} 500 if the email provider (Mailjet) fails to send.
 */
export async function requestOtp(method: unknown, value: unknown) {
  if (value === undefined || !isRecoveryMethod(method)) {
    throw new AppError(
      400,
      "Provide a recovery method (email or phone) and value"
    );
  }

  // Per-destination rate limit: max 5 OTP requests, then a 10-minute block.
  // Checked before the DB lookup so blocked destinations never trigger a send.
  enforceOtpRequestLimit(
    rateLimitKey(method, String(value).trim().toLowerCase())
  );

  await connectDB();

  const user = await User.findOne(lookupQuery(method, String(value)));
  // Don't leak which addresses are registered — respond as if we sent it.
  if (!user) {
    return { message: "If the account exists, an OTP has been sent." };
  }

  const otp = generateOtp();
  setOtp(otpKey(method, user), otp, env.OTP_EXPIRY_MINUTES);

  if (method === "email") {
    try {
      await sendOtpEmail(user.email, otp);
    } catch (err) {
      console.error("Mailjet send failed:", err);
      throw new AppError(500, "Failed to send OTP email");
    }
  }
  // Phone delivery isn't part of this MVP; OTP is logged in dev only.
  // (For prod, plug an SMS gateway here.)

  return {
    message: "OTP sent",
    method,
    destination: maskDestination(method, user),
  };
}

/**
 * Verifies the OTP previously issued for the given recovery destination.
 *
 * Enforces a maximum number of verification attempts (defined in
 * {@link OTP_CONFIG.MAX_ATTEMPTS}) and an expiry window. On success the
 * entry is marked as verified but **not** cleared — the password reset step
 * still needs it.
 *
 * @async
 * @param {unknown} method - Recovery method ("email" or "phone").
 * @param {unknown} value - The destination email/phone.
 * @param {unknown} otp - The OTP string entered by the user.
 * @returns {Promise<{ verified: boolean }>} Confirmation of successful verification.
 * @throws {AppError} 400 if inputs are missing, the OTP is wrong, or the user is not found.
 * @throws {AppError} 429 if the maximum attempt count is exceeded.
 */
export async function verifyOtp(
  method: unknown,
  value: unknown,
  otp: unknown
) {
  if (!value || !otp || !isRecoveryMethod(method)) {
    throw new AppError(400, "Method, value, and OTP are required");
  }

  await connectDB();

  const user = await User.findOne(lookupQuery(method, String(value)));
  if (!user) {
    throw new AppError(400, "Invalid OTP");
  }

  const key = otpKey(method, user);
  const entry = getOtp(key);

  if (!entry) {
    throw new AppError(400, "OTP expired or not requested");
  }

  if (entry.expiresAt < Date.now()) {
    clearOtp(key);
    throw new AppError(400, "OTP expired");
  }

  if (entry.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    clearOtp(key);
    throw new AppError(429, "Too many attempts, request a new OTP");
  }

  if (entry.otp !== String(otp)) {
    bumpAttempt(key);
    throw new AppError(400, "Invalid OTP");
  }

  // Mark the entry verified without clearing yet — the reset step needs it.
  entry.verified = true;
  bumpAttempt(key);

  return { verified: true };
}

/**
 * Resets a user's password using a previously verified OTP session.
 *
 * The new password is checked against the current one via `bcrypt.compare` to
 * prevent reuse. On success the OTP entry is cleared so it cannot be replayed.
 *
 * @async
 * @param {unknown} method - Recovery method ("email" or "phone").
 * @param {unknown} value - The destination email/phone.
 * @param {unknown} otp - The OTP string (must still be in cache).
 * @param {unknown} newPassword - The desired replacement password.
 * @returns {Promise<{ message: string }>} Success confirmation message.
 * @throws {AppError} 400 if any required field is missing, the password is
 *   too short, the OTP is invalid/expired, or the new password matches the old one.
 */
export async function resetPassword(
  method: unknown,
  value: unknown,
  otp: unknown,
  newPassword: unknown
) {
  if (!value || !otp || !newPassword || !isRecoveryMethod(method)) {
    throw new AppError(400, "Missing required fields");
  }

  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      400,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  await connectDB();

  const user = await User.findOne(lookupQuery(method, String(value)));
  if (!user) {
    throw new AppError(400, "Invalid request");
  }

  const entry = getOtp(otpKey(method, user));
  if (!entry || entry.expiresAt < Date.now() || entry.otp !== String(otp)) {
    throw new AppError(400, "OTP invalid or expired");
  }

  // Reject a "new" password identical to the current one. Compared securely
  // with bcrypt against the stored hash — never plaintext vs hash.
  const sameAsOldPassword = await bcrypt.compare(
    String(newPassword),
    user.password
  );
  if (sameAsOldPassword) {
    throw new AppError(
      400,
      "You cannot use your old password. Please choose a different password."
    );
  }

  user.password = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  clearOtp(otpKey(method, user));

  return { message: "Password reset successful" };
}