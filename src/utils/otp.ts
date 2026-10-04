/**
 * @file In-memory OTP store and rate-limiter.
 *
 * Provides generation, storage, and verification of one-time passwords
 * keyed by `email:<value>` or `phone:<value>`. Includes per-key rate
 * limiting to prevent OTP brute-force attempts.
 *
 * Suitable for demo/MVP; replace with Redis or a Mongo collection for
 * production use.
 */

import { AppError } from "./AppError";
import { OTP_CONFIG } from "../constants";
import { OtpEntry, OtpRateEntry } from "../interfaces/otp.interface";

/** OTP storage keyed by identifier (e.g. `email:user@example.com`). */
const store = new Map<string, OtpEntry>();

/** Rate-limit tracking keyed by identifier. */
const rateStore = new Map<string, OtpRateEntry>();

/** Conversion factor: milliseconds per minute. */
const MS_PER_MINUTE = 60_000;

const OTP_RATE_LIMIT_MESSAGE =
  "Too many OTP requests. This email is blocked for 10 minutes. Please try again later.";

/**
 * Rate-limit entries idle for this long (and not blocked) are pruned
 * to prevent unbounded map growth under repeated automated requests.
 */
const RATE_ENTRY_TTL_MS = 30 * MS_PER_MINUTE;

/**
 * Generate a random 6-digit numeric OTP as a string.
 *
 * @returns A string like `"048291"` (always exactly 6 digits).
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store an OTP under the given key with a TTL.
 *
 * @param key - Unique identifier for the OTP (e.g. `email:user@example.com`).
 * @param otp - The OTP value to store.
 * @param ttlMinutes - Time-to-live in minutes before the OTP expires.
 */
export function setOtp(key: string, otp: string, ttlMinutes: number): void {
  store.set(key, {
    otp,
    expiresAt: Date.now() + ttlMinutes * MS_PER_MINUTE,
    attempts: 0,
  });
}

/**
 * Retrieve the stored OTP entry for a key.
 *
 * @param key - The OTP key to look up.
 * @returns The `OtpEntry` if found, otherwise `null`.
 */
export function getOtp(key: string): OtpEntry | null {
  return store.get(key) || null;
}

/**
 * Increment the failed-attempt counter for an OTP entry.
 *
 * @param key - The OTP key whose attempt count should be bumped.
 * @returns The updated `OtpEntry`, or `null` if no entry exists for the key.
 */
export function bumpAttempt(key: string): OtpEntry | null {
  const entry = store.get(key);
  if (!entry) return null;
  entry.attempts += 1;
  store.set(key, entry);
  return entry;
}

/**
 * Delete an OTP entry (e.g. after successful verification or expiry).
 *
 * @param key - The OTP key to remove.
 */
export function clearOtp(key: string): void {
  store.delete(key);
}

/**
 * Remove rate-limit entries that are neither blocked nor recently active,
 * preventing unbounded memory growth.
 *
 * @param now - Current timestamp in milliseconds.
 */
function pruneRateStore(now: number): void {
  for (const [key, entry] of rateStore) {
    if (
      entry.blockedUntil <= now &&
      now - entry.updatedAt > RATE_ENTRY_TTL_MS
    ) {
      rateStore.delete(key);
    }
  }
}

/**
 * Consume one OTP request allowance for the given key.
 *
 * Allows up to `OTP_CONFIG.MAX_REQUESTS` requests; exceeding that starts a
 * `OTP_CONFIG.BLOCK_MINUTES`-long block during which every request is
 * rejected with a 429 error. The block lifts automatically once it expires
 * and the allowance restarts.
 *
 * @param key - The rate-limit key (typically the same as the OTP key).
 * @throws {AppError} 429 when the destination is over its request limit.
 */
export function enforceOtpRequestLimit(key: string): void {
  const now = Date.now();

  pruneRateStore(now);

  const entry = rateStore.get(key);

  if (!entry) {
    rateStore.set(key, { count: 1, blockedUntil: 0, updatedAt: now });
    return;
  }

  entry.updatedAt = now;

  // Still inside an active block — reject outright.
  if (entry.blockedUntil > now) {
    throw new AppError(429, OTP_RATE_LIMIT_MESSAGE);
  }

  // A previous block has lapsed — restart the allowance.
  if (entry.blockedUntil !== 0) {
    entry.count = 0;
    entry.blockedUntil = 0;
  }

  entry.count += 1;

  if (entry.count > OTP_CONFIG.MAX_REQUESTS) {
    entry.blockedUntil = now + OTP_CONFIG.BLOCK_MINUTES * MS_PER_MINUTE;
    rateStore.set(key, entry);
    throw new AppError(429, OTP_RATE_LIMIT_MESSAGE);
  }

  rateStore.set(key, entry);
}