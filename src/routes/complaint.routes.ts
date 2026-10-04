/**
 * @file Complaint route definitions.
 *
 * Customer-facing endpoints for listing, viewing, and creating complaints,
 * as well as updating complaint status. All routes require authentication
 * via the `requireAuth` middleware. A separate `categoryRouter` is exported
 * for the categories sub-path. Mounted at `/complaints` in the application
 * bootstrap.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  upload,
  listComplaintsHandler,
  getComplaintHandler,
  createComplaintHandler,
  updateStatusHandler,
  updateResolutionNoteHandler,
  getCategoriesHandler,
} from "../controllers/complaint.controller";

/** Express router instance for complaint CRUD operations. */
const router = Router();

router.use(requireAuth);

router.get("/", listComplaintsHandler);
router.get("/:id", getComplaintHandler);
router.post("/", upload, createComplaintHandler);
router.patch("/:id/status", updateStatusHandler);
router.patch("/:id/resolution-note", updateResolutionNoteHandler);

const categoryRouter = Router();
categoryRouter.use(requireAuth);
categoryRouter.get("/", getCategoriesHandler);

export { categoryRouter };
export default router;