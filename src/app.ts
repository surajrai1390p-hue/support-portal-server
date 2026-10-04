/**
 * Express application entry point.
 *
 * Mounts middleware (CORS, JSON body parser, cookie parser), registers all API
 * route handlers, provides a catch-all 404 handler, and attaches a global
 * error handler. The server starts listening on the port defined in the
 * environment configuration.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { connectDB } from "./config/db";
import { env } from "./config/env";

import authRoutes from "./routes/auth.routes";
import registerRoutes from "./routes/register.routes";
import forgotRoutes from "./routes/forgot.routes";
import supportRoutes from "./routes/support.routes";
import complaintRoutes, {
  categoryRouter,
} from "./routes/complaint.routes";
import { AppError } from "./utils/AppError";

const app = express();

// Cross-origin requests from the frontend (env.CLIENT_ORIGIN) are allowed
// to send/receive cookies — needed for the session cookie.
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());


/**
 * Root route that returns a JSON overview of the server and its available
 * endpoints. Useful for quick verification when opening the server URL
 * directly in a browser.
 */
app.get("/", (_req: Request, res: Response) =>
  res.json({
    
    name: "support-portal-server",
    status: "ok",
    endpoints: [
      "GET  /health",
      "POST /api/register",
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET  /api/auth/me",
      "POST /api/forgot/check-email",
      "POST /api/forgot/request",
      "POST /api/forgot/verify",
      "POST /api/forgot/reset",
      "POST /api/support",
      "GET  /api/complaints",
      "POST /api/complaints",
      "GET  /api/complaint-categories",
    ],
  })
);

/**
 * Health check endpoint used by load balancers, orchestrators, and smoke
 * tests to verify the server process is alive and responding.
 */
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

// Serve uploaded attachments.
app.use("/uploads", express.static("uploads"));

// API routers.
app.use("/api/auth", authRoutes);
app.use("/api/register", registerRoutes);
app.use("/api/forgot", forgotRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/complaint-categories", categoryRouter);

// Anything that didn't match above.
app.use((_req: Request, res: Response) =>
  res.status(404).json({ success: false, message: "Not found" })
);

/**
 * Global error-handling middleware. Catches any errors that bubble up from
 * route handlers (e.g. JSON parse failures, multer upload errors, explicit
 * throws). If the error is an {@link AppError} the mapped status code is
 * returned; otherwise a generic 500 is sent.
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[server] error:", err?.message || err);
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  res.status(500).json({ success: false, message: "Server error" });
});

const PORT = Number(env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Best-effort DB connect; the server stays up even if it fails so
// non-DB endpoints (e.g. /health) keep responding.
connectDB().catch((e) => console.error("[server] connectDB threw:", e));