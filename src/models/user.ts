/**
 * @file User model — single Mongoose collection that represents both
 *       Customers and Support agents in the support-portal domain.
 *       The `role` discriminator determines which persona the document
 *       fulfils at runtime.
 */

import mongoose from "mongoose";
import { ROLES } from "../constants";

const userSchema = new mongoose.Schema(
  {
    /** User's display name (optional, trimmed before save). */
    fullName: {
      type: String,
      trim: true,
    },
    /** Unique handle / login name; required and case-sensitive. */
    Username: {
      type: String,
      required: true,
      trim: true,
    },
    /** Organisation the user belongs to (required for every account). */
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    /** Primary email address — unique, lowercased, and trimmed. */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    /** Hashed password (never stored in plain text). */
    password: {
      type: String,
      required: true,
    },
    /** Contact phone number. */
    mobile: {
      type: String,
      required: true,
    },
    /** Role flag: `customer` or `support`; defaults to `customer`. */
    role: {
      type: String,
      enum: [ROLES.CUSTOMER, ROLES.SUPPORT],
      default: ROLES.CUSTOMER,
    },
    /** Soft-delete / lock flag — inactive users cannot authenticate. */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Unique (case-sensitive) username index. Sparse so legacy documents that
// predate the Username field (and therefore have none) don't block the index.
userSchema.index({ Username: 1 }, { unique: true, sparse: true });

// Reuse the existing model if Mongoose has it cached (Next dev / nodemon
// reloads the module on each restart).
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;