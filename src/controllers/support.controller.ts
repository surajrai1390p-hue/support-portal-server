/**
 * Support User Controller
 *
 * Handles creation and updating of support staff accounts. Used by admins
 * to manage the support team.
 *
 * @module controllers/support
 */

import { Request, Response } from "express";
import { createSupportUser } from "../services/support.service";
import { successResponse, failureResponse } from "../utils/response";
import { AppError } from "../utils/AppError";

/**
 * Creates or updates a support user account.
 *
 * If the user already exists, their details are updated. Returns 201 for
 * new accounts and 200 for updates.
 *
 * @param req - Express request. Body: support user fields.
 * @param res - Express response.
 * @returns JSON response with the created/updated support user and a `created` flag.
 */
export async function createSupportUserHandler(
  req: Request,
  res: Response
) {
  try {
    const result = await createSupportUser(req.body || {});
    return successResponse(
      res,
      result.created
        ? "Support user created"
        : "Support user updated",
      result,
      result.created ? 201 : 200
    );
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Create support user error:", error);
    return failureResponse(res, "Failed to create support user", 500);
  }
}