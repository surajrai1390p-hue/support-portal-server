/**
 * @fileoverview Complaint (ticket) service — business logic for listing, creating,
 * retrieving, and updating support tickets. New tickets default to "Pending" so
 * they land in the visible board column of the customer dashboard.
 *
 * @module complaint.service
 */

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import Ticket from "../models/ticket";
import Counter from "../models/counter";
import { AppError } from "../utils/AppError";
import { getPresignedUrl } from "../utils/s3";
import { sendComplaintNotificationEmail } from "../utils/mailer";
import { TICKET_FEATURES, TICKET_MODULES, ROLES } from "../constants";

export type CreateComplaintInput = {
  title?: string;
  description?: string;
  module?: string;
  feature?: string;
  attachments?: Array<{
    fileUrl: string;
    originalName: string;
    fileType: string;
  }>;
};

export type ListComplaintsParams = {
  userId: string;
  role: string;
};

/**
 * Transforms a raw Mongoose Ticket document into the complaint object shape
 * expected by the frontend.
 *
 * S3-stored attachments (bare object keys) are swapped for short-lived
 * presigned download URLs; legacy `/uploads/...` paths are passed through.
 * The `attachment` field keeps the first file's URL for backward compatibility,
 * while `attachments` carries every file with its metadata.
 *
 * @async
 * @param {any} ticket - Mongoose ticket document (may be populated).
 * @param {string} [customerEmail] - Override email used when the populated
 *   reference is unavailable.
 * @returns {Promise<object>} Formatted complaint object.
 */
async function toComplaint(ticket: any, customerEmail?: string) {
  const attachments = await Promise.all(
    (ticket.attachments ?? []).map(async (a: any) => {
      const storedUrl = a?.fileUrl;
      const fileUrl = storedUrl
        ? storedUrl.startsWith("/uploads/")
          ? storedUrl
          : await getPresignedUrl(storedUrl)
        : undefined;
      return {
        fileUrl,
        originalName: a?.originalName,
        fileType: a?.fileType,
      };
    })
  );

  return {
    _id: String(ticket._id),
    ticketNumber: ticket.ticketId,
    title: ticket.title,
    description: ticket.description,
    module: ticket.module,
    feature: ticket.feature,
    status: ticket.status,
    resolutionNote: ticket.resolutionNote || null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    attachment: attachments[0]?.fileUrl,
    attachments,
    userId: String(ticket.customerId?._id || ticket.customerId),
    customerEmail:
      customerEmail ||
      ticket.customerId?.email ||
      undefined,
    companyName:
      ticket.customerId?.companyName ||
      undefined,
  };
}

/**
 * Generates a sequential, human-friendly ticket ID in the format `SP-YYYYMMDD-XXXX`.
 *
 * The counter is atomically incremented via `$inc` and persisted in MongoDB so
 * the sequence survives server restarts.
 *
 * @async
 * @returns {Promise<string>} A unique ticket identifier.
 */
async function generateTicketId(): Promise<string> {
  const now = new Date();
  const yyyymmdd = `${now.getFullYear()}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: "ticketId" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );

  const padded = String(counter.seq).padStart(4, "0");
  return `SP-${yyyymmdd}-${padded}`;
}

/**
 * Creates a new support ticket (complaint) on behalf of a customer.
 *
 * Validates the input fields, generates a unique ticket ID, persists the
 * ticket in "Pending" status, and fires an async notification email.
 *
 * @async
 * @param {CreateComplaintInput} input - Ticket fields (title, description, module, feature, attachments).
 * @param {{ userId: string; email: string }} customer - Authenticated customer context.
 * @returns {Promise<object>} The newly created complaint formatted for the frontend.
 * @throws {AppError} 400 if required fields are missing or module/feature is invalid.
 */
export async function createComplaint(
  input: CreateComplaintInput,
  customer: { userId: string; email: string }
) {
  const title = input.title?.trim();
  const description = input.description?.trim();
  const module = input.module?.trim();
  const feature = input.feature?.trim();

  if (!title || !description || !module || !feature) {
    throw new AppError(400, "Title, description, module and feature are required");
  }

  if (!TICKET_MODULES.includes(module as any)) {
    throw new AppError(400, "Invalid module");
  }

  if (!TICKET_FEATURES.includes(feature as any)) {
    throw new AppError(400, "Invalid feature");
  }

  await connectDB();

  const ticketId = await generateTicketId();
  const attachments = input.attachments ?? [];

  const ticket = await Ticket.create({
    ticketId,
    title,
    description,
    module,
    feature,
    status: "Pending",
    customerId: new mongoose.Types.ObjectId(customer.userId),
    attachments,
  });

  sendComplaintNotificationEmail({
    ticketId,
    title,
    description,
    module,
    feature,
    customerEmail: customer.email,
  }).catch((err) => console.error("Failed to send complaint notification email:", err));

  return await toComplaint(ticket, customer.email);
}

/**
 * Lists complaints visible to the given user.
 *
 * Support agents see all tickets; customers see only their own.
 *
 * @async
 * @param {ListComplaintsParams} params - User ID and role.
 * @returns {Promise<object[]>} Array of formatted complaint objects, newest first.
 */
export async function listComplaints({
  userId,
  role,
}: ListComplaintsParams) {
  await connectDB();

  const query =
    role === ROLES.SUPPORT ? {} : { customerId: new mongoose.Types.ObjectId(userId) };

  const tickets = await Ticket.find(query)
    .populate("customerId", "email fullName companyName")
    .sort({ createdAt: -1 });

  return Promise.all(tickets.map((ticket) => toComplaint(ticket)));
}

/**
 * Retrieves a single complaint by its ticket ID.
 *
 * Customers can only access their own tickets; support agents have full access.
 *
 * @async
 * @param {string} ticketId - Human-readable ticket ID (e.g. "SP-20260101-0001").
 * @param {string} userId - ID of the requesting user.
 * @param {string} role - Role of the requesting user.
 * @returns {Promise<object>} Formatted complaint object.
 * @throws {AppError} 404 if the ticket does not exist.
 * @throws {AppError} 403 if the user is not authorized to view the ticket.
 */
export async function getComplaint(ticketId: string, userId: string, role: string) {
  await connectDB();

  const ticket = await Ticket.findOne({ ticketId })
    .populate("customerId", "email fullName companyName");

  if (!ticket) {
    throw new AppError(404, "Complaint not found");
  }

  const ticketUserId = String(ticket.customerId?._id || ticket.customerId);
  if (role !== ROLES.SUPPORT && ticketUserId !== userId) {
    throw new AppError(403, "You do not have access to this complaint");
  }

  return await toComplaint(ticket, ticket.customerId?.email);
}

/**
 * Returns the list of valid ticket feature categories.
 *
 * @returns {string[]} A copy of the TICKET_FEATURES constant array.
 */
export function listCategories() {
  return [...TICKET_FEATURES];
}

const STATUS_TRANSITIONS: Record<string, string> = {
  Pending: "In Progress",
  "In Progress": "Resolved",
};

/**
 * Advances a ticket through its allowed status transitions.
 *
 * Only support agents may change status. The valid transitions are:
 * - Pending → In Progress
 * - In Progress → Resolved
 *
 * When resolved, the `resolvedAt` timestamp is recorded and a
 * `resolutionNote` is required.
 *
 * @async
 * @param {string} ticketId - Human-readable ticket ID.
 * @param {string} newStatus - Desired target status.
 * @param {string} userId - ID of the requesting user.
 * @param {string} role - Role of the requesting user.
 * @param {string} [resolutionNote] - Note describing how the complaint was resolved (required when resolving).
 * @returns {Promise<object>} Updated complaint object.
 * @throws {AppError} 403 if the user is not a support agent.
 * @throws {AppError} 404 if the ticket does not exist.
 * @throws {AppError} 400 if the requested transition is not allowed or resolution note is missing.
 */
export async function updateStatus(
  ticketId: string,
  newStatus: string,
  userId: string,
  role: string,
  resolutionNote?: string
) {
  await connectDB();

  if (role !== ROLES.SUPPORT) {
    throw new AppError(403, "Only support agents can change ticket status");
  }

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new AppError(404, "Complaint not found");
  }

  const allowedNext = STATUS_TRANSITIONS[ticket.status];
  if (!allowedNext) {
    throw new AppError(
      400,
      `Cannot change status from "${ticket.status}" — no further transitions allowed`
    );
  }

  if (newStatus !== allowedNext) {
    throw new AppError(
      400,
      `Invalid transition: "${ticket.status}" can only move to "${allowedNext}"`
    );
  }

  if (newStatus === "Resolved") {
    const note = resolutionNote?.trim();
    if (!note) {
      throw new AppError(400, "Resolution note is required when resolving a complaint");
    }
    ticket.resolutionNote = note;
    ticket.resolvedAt = new Date();
  }

  ticket.status = newStatus as any;
  await ticket.save();

  const updated = await Ticket.findOne({ ticketId })
    .populate("customerId", "email fullName companyName");

  return await toComplaint(updated!, updated?.customerId?.email);
}

/**
 * Updates the resolution note on an already-resolved ticket.
 *
 * Only support agents may edit the note. The ticket must already be in
 * "Resolved" status.
 *
 * @async
 * @param {string} ticketId - Human-readable ticket ID.
 * @param {string} resolutionNote - Updated resolution note text.
 * @param {string} userId - ID of the requesting user.
 * @param {string} role - Role of the requesting user.
 * @returns {Promise<object>} Updated complaint object.
 * @throws {AppError} 403 if the user is not a support agent.
 * @throws {AppError} 404 if the ticket does not exist.
 * @throws {AppError} 400 if the ticket is not resolved or note is empty.
 */
export async function updateResolutionNote(
  ticketId: string,
  resolutionNote: string,
  userId: string,
  role: string
) {
  await connectDB();

  if (role !== ROLES.SUPPORT) {
    throw new AppError(403, "Only support agents can edit resolution notes");
  }

  const note = resolutionNote?.trim();
  if (!note) {
    throw new AppError(400, "Resolution note cannot be empty");
  }

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    throw new AppError(404, "Complaint not found");
  }

  if (ticket.status !== "Resolved") {
    throw new AppError(400, "Resolution note can only be added to resolved complaints");
  }

  ticket.resolutionNote = note;
  await ticket.save();

  const updated = await Ticket.findOne({ ticketId })
    .populate("customerId", "email fullName companyName");

  return await toComplaint(updated!, updated?.customerId?.email);
}