/**
 * Forgot Password Controller
 *
 * Implements a multi-step password recovery flow via email or phone:
 *   1. Check if the identifier is registered
 *   2. Request an OTP
 *   3. Verify the OTP
 *   4. Reset the password
 *
 * Each step is a standalone HTTP handler that delegates to the forgot
 * password service.
 *
 * @module controllers/forgot
 */

import { Request, Response } from "express";
import {
  checkEmailExists,
  requestOtp,
  verifyOtp,
  resetPassword,
} from "../services/forgot.service";
import { successResponse, failureResponse } from "../utils/response";
import { AppError } from "../utils/AppError";

/**
 * Step 0 — Checks whether an email or phone number is registered.
 *
 * @param req - Express request. Body: `{ method: "email" | "phone", value: string }`.
 * @param res - Express response.
 * @returns JSON response indicating whether the identifier exists.
 */
export async function checkEmailHandler(req: Request, res: Response) {
  try {
    const { method, value } = req.body || {};
    const result = await checkEmailExists(method, value);
    return successResponse(res, "Email check completed", result);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Forgot check-email error:", error);
    return failureResponse(res, "Unable to verify email", 500);
  }
}

/**
 * Step 1 — Requests an OTP to be sent to the given email or phone.
 *
 * @param req - Express request. Body: `{ method: "email" | "phone", value: string }`.
 * @param res - Express response.
 * @returns JSON response with the delivery method and masked destination.
 */
export async function requestOtpHandler(req: Request, res: Response) {
  try {
    const { method, value } = req.body || {};
    const result = await requestOtp(method, value);
    const data = {
      ...(result.method ? { method: result.method } : {}),
      ...(result.destination ? { destination: result.destination } : {}),
    };
    return successResponse(res, result.message, data);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Forgot request error:", error);
    return failureResponse(res, "Failed to send OTP", 500);
  }
}

/**
 * Step 2 — Verifies the OTP provided by the user.
 *
 * @param req - Express request. Body: `{ method: "email" | "phone", value: string, otp: string }`.
 * @param res - Express response.
 * @returns JSON response confirming OTP verification.
 */
export async function verifyOtpHandler(req: Request, res: Response) {
  try {
    const { method, value, otp } = req.body || {};
    const result = await verifyOtp(method, value, otp);
    return successResponse(res, "OTP verified", result);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Forgot verify error:", error);
    return failureResponse(res, "Verification failed", 500);
  }
}

/**
 * Step 3 — Resets the password using a previously verified OTP.
 *
 * @param req - Express request. Body: `{ method: "email" | "phone", value: string, otp: string, newPassword: string }`.
 * @param res - Express response.
 * @returns JSON response confirming the password has been reset.
 */
export async function resetPasswordHandler(req: Request, res: Response) {
  try {
    const { method, value, otp, newPassword } = req.body || {};
    const result = await resetPassword(method, value, otp, newPassword);
    return successResponse(res, result.message, {});
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Reset error:", error);
    return failureResponse(res, "Reset failed", 500);
  }
}