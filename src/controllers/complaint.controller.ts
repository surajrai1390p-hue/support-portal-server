/**
 * Complaint Controller
 *
 * Handles HTTP endpoints for the complaint lifecycle: creation, retrieval,
 * listing, and status updates. Supports multipart file uploads (up to 5
 * attachments) which are compressed and uploaded to S3 before persistence.
 *
 * @module controllers/complaint
 */

import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import sharp from "sharp";
import {
  createComplaint,
  listComplaints,
  getComplaint,
  updateStatus,
  updateResolutionNote,
  listCategories,
} from "../services/complaint.service";
import { successResponse, failureResponse } from "../utils/response";
import { AppError } from "../utils/AppError";
import { uploadToS3 } from "../utils/s3";
import { ROLES } from "../constants";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — largest allowed (video)
const MAX_FILES = 5;
const MAX_NON_VIDEO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — for PDF, PNG, JPG
const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "video/mp4", "video/webm", "video/quicktime"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * Compresses an uploaded file before S3 upload.
 *
 * Images (PNG/JPEG) are resized to a max dimension and re-encoded as JPEG.
 * Non-image files (e.g., PDF) are returned as-is.
 *
 * @param file - Multer file object from memory storage.
 * @returns Prepared file with buffer, content type, and extension.
 */
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg"];
const IMAGE_MAX_DIMENSION = 1920;
const JPEG_QUALITY = 80;

type PreparedFile = {
  body: Buffer;
  contentType: string;
  ext: string;
};

async function compressAttachment(
  file: Express.Multer.File
): Promise<PreparedFile> {
  const ext = path.extname(file.originalname);
  const isImage =
    IMAGE_MIME_TYPES.includes(file.mimetype) || /\.(png|jpe?g)$/i.test(ext);
  if (!isImage) {
    return { body: file.buffer, contentType: file.mimetype, ext };
  }

  try {
    const body = await sharp(file.buffer)
      .rotate() // respect EXIF orientation before re-encoding
      .resize({
        width: IMAGE_MAX_DIMENSION,
        height: IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" }) // PNG transparency -> white
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return { body, contentType: "image/jpeg", ext: ".jpg" };
  } catch (error) {
    // Undecodable image — fall back to storing the original bytes.
    console.error("Compression failed, storing original:", error);
    return { body: file.buffer, contentType: file.mimetype, ext };
  }
}

/**
 * Multer middleware configured for in-memory file uploads.
 *
 * Accepts up to 5 files (PDF, PNG, JPG) at 10 MB each. Files are held in
 * memory, compressed, then streamed to S3 — nothing is written to disk.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ok =
      ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      /\.(pdf|png|jpe?g|mp4|webm|mov)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    cb(new AppError(400, "Only PDF, PNG, JPG, MP4, WebM, or MOV files are allowed"));
  },
}).array("attachment", MAX_FILES);

/**
 * Lists all complaints visible to the current user.
 *
 * Admin/support users see all complaints; customers see only their own.
 *
 * @param req - Express request with session.
 * @param res - Express response.
 * @returns JSON response with array of complaint objects.
 */
export async function listComplaintsHandler(
  req: Request,
  res: Response
) {
  try {
    const session = req.session;
    if (!session) {
      return failureResponse(res, "Unauthorized", 401);
    }

    const data = await listComplaints({
      userId: session.userId,
      role: session.role,
    });

    return successResponse(res, "Complaints fetched", data);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("List complaints error:", error);
    return failureResponse(res, "Failed to fetch complaints", 500);
  }
}

/**
 * Retrieves a single complaint by ID.
 *
 * Enforces ownership: customers can only access their own complaints.
 *
 * @param req - Express request with `params.id` and session.
 * @param res - Express response.
 * @returns JSON response with the complaint object.
 */
export async function getComplaintHandler(
  req: Request,
  res: Response
) {
  try {
    const session = req.session;
    if (!session) {
      return failureResponse(res, "Unauthorized", 401);
    }

    const data = await getComplaint(
      req.params.id,
      session.userId,
      session.role
    );

    return successResponse(res, "Complaint fetched", data);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Get complaint error:", error);
    return failureResponse(res, "Failed to fetch complaint", 500);
  }
}

/**
 * Creates a new complaint with optional file attachments.
 *
 * Only customers may create complaints. Uploaded files are compressed,
 * stored in S3, and their keys are persisted with the complaint record.
 * Accepts both JSON and multipart/form-data payloads.
 *
 * @param req - Express request with session, body (`title`, `description`, `module`, `feature`), and optional files.
 * @param res - Express response. Returns 201 on success.
 * @returns JSON response with the created complaint.
 */
export async function createComplaintHandler(
  req: Request,
  res: Response
) {
  try {
    const session = req.session;
    if (!session) {
      return failureResponse(res, "Unauthorized", 401);
    }
    if (session.role !== ROLES.CUSTOMER) {
      return failureResponse(
        res,
        "Only customers can register complaints",
        403
      );
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    // Per-file size check: non-video files are capped at 10 MB
    for (const file of files) {
      const isVideo = VIDEO_MIME_TYPES.includes(file.mimetype);
      if (!isVideo && file.size > MAX_NON_VIDEO_SIZE_BYTES) {
        return failureResponse(
          res,
          `File "${file.originalname}" must be 10MB or smaller (videos up to 25MB are allowed)`,
          400
        );
      }
    }

    // Compress each attachment, upload to S3 (private bucket) and store only
    // the object keys; downloads go through presigned URLs at read time.
    const attachments = await Promise.all(
      files.map(async (file) => {
        const prepared = await compressAttachment(file);
        const key = `attachments/${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${prepared.ext}`;
        await uploadToS3(key, prepared.body, prepared.contentType);
        return {
          fileUrl: key,
          originalName: file.originalname,
          fileType: prepared.contentType,
        };
      })
    );

    const data = await createComplaint(
      {
        title: req.body?.title,
        description: req.body?.description,
        module: req.body?.module,
        feature: req.body?.feature,
        attachments,
      },
      { userId: session.userId, email: session.email }
    );

    return successResponse(
      res,
      "Complaint registered successfully",
      data,
      201
    );
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Create complaint error:", error);
    return failureResponse(res, "Failed to register complaint", 500);
  }
}

/**
 * Updates the status of an existing complaint.
 *
 * Admin/support users can transition complaint statuses. Customers are
 * restricted from this operation.
 *
 * @param req - Express request with `params.id`, `body.status`, and session.
 * @param res - Express response.
 * @returns JSON response with the updated complaint.
 */
export async function updateStatusHandler(
  req: Request,
  res: Response
) {
  try {
    const session = req.session;
    if (!session) {
      return failureResponse(res, "Unauthorized", 401);
    }

    const { status, resolutionNote } = req.body;
    if (!status || typeof status !== "string") {
      return failureResponse(res, "Status is required", 400);
    }

    const data = await updateStatus(
      req.params.id,
      status,
      session.userId,
      session.role,
      resolutionNote
    );

    return successResponse(res, "Status updated", data);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Update status error:", error);
    return failureResponse(res, "Failed to update status", 500);
  }
}

/**
 * Updates the resolution note on an already-resolved complaint.
 *
 * Only support agents may edit the note.
 *
 * @param req - Express request with `params.id`, `body.resolutionNote`, and session.
 * @param res - Express response.
 * @returns JSON response with the updated complaint.
 */
export async function updateResolutionNoteHandler(
  req: Request,
  res: Response
) {
  try {
    const session = req.session;
    if (!session) {
      return failureResponse(res, "Unauthorized", 401);
    }

    const { resolutionNote } = req.body;
    if (!resolutionNote || typeof resolutionNote !== "string") {
      return failureResponse(res, "Resolution note is required", 400);
    }

    const data = await updateResolutionNote(
      req.params.id,
      resolutionNote,
      session.userId,
      session.role
    );

    return successResponse(res, "Resolution note updated", data);
  } catch (error) {
    if (error instanceof AppError) {
      return failureResponse(res, error.message, error.status);
    }
    console.error("Update resolution note error:", error);
    return failureResponse(res, "Failed to update resolution note", 500);
  }
}

/**
 * Returns the list of available complaint categories.
 *
 * Synchronous — reads from a static configuration. No auth required.
 *
 * @param _req - Express request (unused).
 * @param res - Express response.
 * @returns JSON response with array of category objects.
 */
export function getCategoriesHandler(
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  return successResponse(res, "OK", listCategories());
}