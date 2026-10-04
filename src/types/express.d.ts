/**
 * Express type augmentation.
 *
 * Extends the global Express `Request` interface with an optional `session`
 * property that holds the decoded JWT payload after authentication. This
 * allows route handlers and middleware to access `req.session` without
 * TypeScript compilation errors.
 */

import { SessionPayload } from "../interfaces/auth.interface";

declare global {
  namespace Express {
    /** Augmented Express request with an optional authenticated session. */
    interface Request {
      /** Decoded session payload populated by the auth middleware, or `null` / `undefined` when unauthenticated. */
      session?: SessionPayload | null;
    }
  }
}

export {};