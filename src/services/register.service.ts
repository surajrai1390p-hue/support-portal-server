/**
 * @fileoverview Registration service — validates customer inputs and creates new
 * user accounts with the "Customer" role. Handles username generation,
 * uniqueness checks, and password hashing.
 *
 * @module register.service
 */

import bcrypt from "bcrypt";
import { connectDB } from "../config/db";
import User from "../models/user";
import { AppError } from "../utils/AppError";
import { usernameQuery } from "../utils/auth";
import { MOBILE_REGEX, EMAIL_REGEX, BCRYPT_ROUNDS, ROLES } from "../constants";

export type RegisterInput = {
  fullName?: string;
  Username?: string;
  companyName?: string;
  mobile?: string;
  email?: string;
  password?: string;
};

export type RegisterResult = {
  user: { id: unknown; username: string; email: string };
};

/**
 * Derives a username from a full name by lowercasing, replacing spaces with
 * underscores, stripping non-alphanumeric characters, and appending a random
 * 4-digit suffix.
 *
 * @param {string} fullName - The user's display name.
 * @returns {string} A candidate username string.
 */
function generateUsername(fullName: string): string {
  const base = fullName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `${base}${randomNumber}`;
}

/**
 * Registers a new customer account.
 *
 * Validates all required fields, ensures the email and username are unique,
 * hashes the password, and inserts the user document. If a uniqueness
 * collision occurs after the pre-check (e.g. a race between concurrent
 * requests), the duplicate-key error is mapped to a user-friendly 400.
 *
 * @async
 * @param {RegisterInput} input - Customer registration fields.
 * @returns {Promise<RegisterResult>} The newly created user's ID, username, and email.
 * @throws {AppError} 400 if any required field is missing, the mobile number
 *   or email format is invalid, or the username/email is already taken.
 */
export async function registerCustomer(
  input: RegisterInput
): Promise<RegisterResult> {
  const { fullName, Username, companyName, mobile, email, password } = input;

  if (!fullName || !companyName || !mobile || !email || !password) {
    throw new AppError(400, "All fields are required");
  }

  if (!MOBILE_REGEX.test(mobile)) {
    throw new AppError(400, "Mobile must be a 10-digit number");
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new AppError(400, "Invalid email address");
  }

  await connectDB();

  const normalizedEmail = email.toLowerCase();

  // The username is generated automatically from the full name unless the
  // client already supplied one. Either way we guarantee it is unique.
  let username = Username ? Username.trim() : generateUsername(fullName);

  if (Username && (await User.findOne(usernameQuery(username)))) {
    throw new AppError(400, "Username already exists");
  }
  while (await User.findOne(usernameQuery(username))) {
    username = generateUsername(fullName);
  }

  if (await User.findOne({ email: normalizedEmail })) {
    throw new AppError(400, "Email already exists");
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await User.create({
      fullName: fullName.trim(),
      Username: username,
      companyName,
      mobile,
      email: normalizedEmail,
      password: hashed,
      role: ROLES.CUSTOMER,
    });
  } catch (error) {
    // The DB unique index backs up the pre-checks above (a race between the
    // findOne and the insert can still collide). Map the duplicate-key error
    // to the same friendly 400 messages instead of a generic 500.
    if ((error as { code?: number }).code === 11000) {
      const duplicateEmail = await User.findOne({ email: normalizedEmail });
      if (duplicateEmail) throw new AppError(400, "Email already exists");
      throw new AppError(400, "Username already exists");
    }
    throw error;
  }

  return {
    user: { id: user._id, username: user.Username, email: user.email },
  };
}