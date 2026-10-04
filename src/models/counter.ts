/**
 * @file Counter model — atomic auto-increment counters persisted in MongoDB.
 *       Used primarily to generate sequential, gap-free ticket IDs without
 *       race conditions under concurrent writes.
 */

import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  /** Logical name of the counter (e.g. "ticketId"). */
  _id: { type: String, required: true },
  /** Current sequence value; incremented atomically before each use. */
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export default Counter;
