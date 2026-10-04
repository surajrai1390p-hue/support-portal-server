/**
 * MongoDB connection helper.
 *
 * Provides a single {@link connectDB} function that safely connects to
 * MongoDB using the connection string from the environment configuration.
 * The function is idempotent — it can be called multiple times and will
 * reuse an existing connection or cache the in-flight promise so that no
 * duplicate connection attempts are started.
 */

import mongoose from "mongoose";
import { env } from "./env";

/** Cached promise for an in-flight connection attempt. */
let connecting: Promise<void> | null = null;

/**
 * Connect to MongoDB using the URI from `env.MONGO_URI`.
 *
 * The function is safe to call multiple times:
 * - If a connection is already open (`readyState >= 1`), it returns
 *   immediately.
 * - If a connection attempt is already in progress, the same promise is
 *   returned to callers so no duplicate attempts are made.
 *
 * When `MONGO_URI` is not set, the function logs a warning and returns
 * without throwing, allowing the server to start in a degraded mode.
 *
 * @returns A promise that resolves once the connection is established or
 *          the operation is skipped.
 */
export async function connectDB(): Promise<void> {
  // Already connected or currently connecting.
  if (mongoose.connection.readyState >= 1) return;
  if (connecting) return connecting;

  connecting = (async () => {
    if (!env.MONGO_URI) {
      console.warn("[db] MONGO_URI not set; DB-backed endpoints will fail.");
      return;
    }
    try {
      await mongoose.connect(env.MONGO_URI);
      console.log("MongoDB Connected");
    } catch (error) {
      console.error("[db] connect failed:", (error as Error).message);
    }
  })();

  return connecting;
}