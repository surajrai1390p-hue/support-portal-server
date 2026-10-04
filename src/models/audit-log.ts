/**
 * @file AuditLog model — immutable audit trail for Ticket changes.
 *       Each document captures a single status or assignee mutation,
 *       recording who made the change, what field was altered, and the
 *       before/after values for compliance and debugging purposes.
 */

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    /** Reference to the Ticket that was modified. */
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
    },
    /** Reference to the User (Customer or Support) who performed the action. */
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    /** Description of the action taken (e.g. "status_change", "assign"). */
    action: { type: String, required: true },
    /** Previous value of the changed field (null for creation events). */
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    /** New value of the changed field. */
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;