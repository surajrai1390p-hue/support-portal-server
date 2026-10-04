/**
 * @fileoverview Support-agent user service — reusable function to create (or
 * upsert) a Support user. Can be called from an API route, a script, or
 * anywhere a Support user needs to be created without a separate seed file.
 *
 * @module support.service
 */

import bcrypt from "bcrypt";
import { connectDB } from "../config/db";
import User from "../models/user";
import { AppError } from "../utils/AppError";
import { BCRYPT_ROUNDS, ROLES } from "../constants";

export type CreateSupportUserInput = {
  Username?: string;
  companyName?: string;
  mobile?: string;
  email?: string;
  password?: string;
};

export type CreateSupportUserResult = {
  created: boolean;
  user: { id: unknown; username: string; email: string };
};

const DEFAULT_SUPPORT_USER: CreateSupportUserInput = {
  Username: "support_demo",
  companyName: "Sharpminds",
  email: "support@sharpminds.local",
  mobile: "9999999999",
  password: "Support@123",
};

/**
 * Creates or updates a Support agent account.
 *
 * If a user with the given email already exists, the existing document is
 * updated with the new details and re-activated. Otherwise a new user is
 * created with the `SUPPORT` role. Passwords are always re-hashed.
 *
 * @async
 * @param {CreateSupportUserInput} [input={}] - Support user fields. Defaults
 *   mirror the legacy seed script (`DEFAULT_SUPPORT_USER`).
 * @returns {Promise<CreateSupportUserResult>} The created/updated user info
 *   and a flag indicating whether the user was newly created.
 * @throws {AppError} 400 if any required field is missing.
 */
export async function createSupportUser(
  input: CreateSupportUserInput = {}
): Promise<CreateSupportUserResult> {
  const details = { ...DEFAULT_SUPPORT_USER, ...input };

  if (
    !details.Username ||
    !details.companyName ||
    !details.mobile ||
    !details.email ||
    !details.password
  ) {
    throw new AppError(
      400,
      "Username, companyName, mobile, email, and password are required"
    );
  }

  await connectDB();

  const normalizedEmail = details.email.toLowerCase();
  const normalizedUsername = details.Username.trim();
  const hashed = await bcrypt.hash(details.password, BCRYPT_ROUNDS);

  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    existing.Username = normalizedUsername;
    existing.companyName = details.companyName;
    existing.mobile = details.mobile;
    existing.password = hashed;
    existing.role = ROLES.SUPPORT;
    existing.isActive = true;
    await existing.save();

    return {
      created: false,
      user: { id: existing._id, username: existing.Username, email: existing.email },
    };
  }

  const user = await User.create({
    Username: normalizedUsername,
    companyName: details.companyName,
    mobile: details.mobile,
    email: normalizedEmail,
    password: hashed,
    role: ROLES.SUPPORT,
  });

  return {
    created: true,
    user: { id: user._id, username: user.Username, email: user.email },
  };
}