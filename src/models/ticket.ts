/**
 * @file Ticket model — represents a single support request raised by a
 *       Customer.  The document tracks its lifecycle from creation through
 *       assignment, resolution, and closure.  Status, module, and feature
 *       enumerations follow the project README spec.
 */

import mongoose from "mongoose";
import {
  TICKET_STATUSES,
  TICKET_MODULES,
  TICKET_FEATURES,
} from "../constants";

const ticketSchema = new mongoose.Schema(
  {
    /** Human-readable ticket identifier (unique, e.g. "TKT-0001"). */
    ticketId: { type: String, unique: true, required: true },
    /** Short summary of the issue. */
    title: { type: String, required: true, trim: true },
    /** Detailed description of the problem or request. */
    description: { type: String, required: true },
    /** Product module the ticket relates to (from TICKET_MODULES enum). */
    module: { type: String, enum: TICKET_MODULES, required: true },
    /** Specific feature within the module (from TICKET_FEATURES enum). */
    feature: { type: String, enum: TICKET_FEATURES, required: true },
    /** Current lifecycle state — starts as "Pending". */
    status: { type: String, enum: TICKET_STATUSES, default: "Pending" },
    /** Reference to the Customer (User) who opened the ticket. */
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    /** Reference to the Support agent assigned (null until claimed). */
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    /** Array of file attachments uploaded with the ticket. */
    attachments: [
      {
        /** Stored file name on disk / object store. */
        fileName: String,
        /** Original name of the file as uploaded by the user. */
        originalName: String,
        /** MIME type of the uploaded file. */
        fileType: String,
        /** Accessible URL or path to the stored file. */
        fileUrl: String,
        /** Timestamp when the attachment was uploaded. */
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    /** Resolution note added by support agent when resolving the ticket. */
    resolutionNote: { type: String, default: null },
    /** When the ticket was marked as resolved (null until resolved). */
    resolvedAt: { type: Date, default: null },
    /** When the ticket was finally closed (null until closed). */
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);

export default Ticket;