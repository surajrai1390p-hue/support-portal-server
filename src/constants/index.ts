/**
 * Centralised constants shared across controllers, services, models, and
 * utility modules. Keeps magic strings and configuration values in a
 * single, importable location.
 */

/** User roles within the support portal. */
export const ROLES = {
  CUSTOMER: "Customer",
  SUPPORT: "Support",
} as const;

/**
 * Ordered list of all possible ticket statuses. The order reflects the
 * typical lifecycle of a support ticket from creation through resolution.
 */
export const TICKET_STATUSES = [
  "Pending",
  "Open",
  "Assigned",
  "In Progress",
  "Waiting for Customer",
  "Resolved",
  "Closed",
  "Cancelled",
] as const;

/**
 * Functional areas (features) that a support ticket can be associated
 * with. Used for categorisation and filtering.
 */
export const TICKET_FEATURES = [
  "Inquiry",
  "Quotation",
  "Customer Order",
  "Sales Invoice",
  "Purchase",
  "Inventory",
  "Production",
  "Accounts",
  "General Support",
] as const;

/**
 * Software modules available in the Register Complaint form. Currently
 * only "Sales" is supported.
 */
export const TICKET_MODULES = [
  "Sales",
] as const;

/** Name of the cookie used to store the session JWT. */
export const SESSION_COOKIE = "sp_session";

/** Lifetime of the session cookie expressed as a `ms`-style string. */
export const SESSION_EXPIRY = "7d";

/** Lifetime of the session cookie in milliseconds (7 days). */
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * OTP (One-Time Password) configuration. Governs maximum verification
 * attempts, default time-to-live, and per-destination rate limiting.
 */
export const OTP_CONFIG = {
  /** Maximum number of incorrect OTP attempts before the code is invalidated. */
  MAX_ATTEMPTS: 5,
  /** Default number of minutes an OTP remains valid. */
  DEFAULT_TTL_MINUTES: 5,
  /** Maximum OTP requests allowed per destination within the block window. */
  MAX_REQUESTS: 5,
  /** Number of minutes a destination is blocked after exceeding the request limit. */
  BLOCK_MINUTES: 10,
} as const;

/** Regex for validating Indian 10-digit mobile numbers (digits only). */
export const MOBILE_REGEX = /^[0-9]{10}$/;

/** Basic regex for validating email addresses. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Number of salt rounds used by bcrypt for password hashing. */
export const BCRYPT_ROUNDS = 10;

/** Minimum number of characters required for user passwords. */
export const MIN_PASSWORD_LENGTH = 8;