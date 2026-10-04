/**
 * Registration Controller
 *
 * Handles new customer registration. Delegates to the register service
 * which validates input and persists the new user record.
 *
 * @module controllers/register
 */

import { Request, Response } from "express";
import { registerCustomer } from "../services/register.service";
import { successResponse, failureResponse } from "../utils/response";
import { AppError } from "../utils/AppError";

/**
 * Registers a new customer account.
 *
 * @param req - Express request. Body: registration fields (name, email, password, etc.).
 * @param res - Express response. Returns 201 on success.
 * @returns JSON response with the created user data.
 */
export async function registerHandler(req: Request, res: Response) {
  try {
    const result = await registerCustomer(req.body || {});
    return successResponse(res, "Registration successful", result, 201);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Register error:", error);
    return failureResponse(res, "Registration failed", 500);
  }
}