/**
 * @file Standard API response helpers.
 *
 * Provides two functions that produce a consistent JSON envelope for
 * success and failure responses:
 *
 * Success:  `{ success: true, message, data }`
 * Failure:  `{ success: false, message }`
 */

import { Response } from "express";

/**
 * Send a successful JSON response.
 *
 * @param res - Express response object.
 * @param message - Human-readable success message.
 * @param data - Arbitrary payload to include (defaults to `{}`).
 * @param status - HTTP status code (defaults to `200`).
 * @returns The Express `Response` for chaining.
 */
export function successResponse(
  res: Response,
  message: string,
  data: unknown = {},
  status: number = 200
) {
  return res.status(status).json({ success: true, message, data });
}

/**
 * Send a failure JSON response.
 *
 * @param res - Express response object.
 * @param message - Human-readable error message.
 * @param status - HTTP status code (defaults to `400`).
 * @returns The Express `Response` for chaining.
 */
export function failureResponse(
  res: Response,
  message: string,
  status: number = 400
) {
  return res.status(status).json({ success: false, message });
}