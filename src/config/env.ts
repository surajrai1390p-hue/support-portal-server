/**
 * Environment configuration.
 *
 * Loads `.env` variables via `dotenv` (executed as a side-effect on import)
 * and re-exports them as a single, typed `env` object. Every other module
 * in the application should import `env` to access configuration values
 * rather than reading `process.env` directly.
 */

import dotenv from "dotenv";
dotenv.config();

/**
 * Centralised, typed access to all environment variables used by the
 * server. Each property falls back to a sensible default when the
 * corresponding variable is absent from the environment.
 */
export const env = {
  /** MongoDB connection string. */
  MONGO_URI: process.env.MONGO_URI || "",
  /** Secret used to sign and verify JWT session tokens. */
  JWT_SECRET: process.env.JWT_SECRET || "",

  // ============================================
  // Gmail SMTP (Nodemailer) — ACTIVE EMAIL PROVIDER
  // ============================================
  /** SMTP host used to send emails (Gmail: smtp.gmail.com). */
  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  /** SMTP port used to send emails (587 for TLS, 465 for SSL). */
  EMAIL_PORT: Number(process.env.EMAIL_PORT || 587),
  /** Gmail account used as the sender. */
  EMAIL_USER: process.env.EMAIL_USER || "",
  /** Gmail App Password for the sender account. */
  EMAIL_PASS: process.env.EMAIL_PASS || "",
  /** Display name shown as the sender in outgoing emails. */
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || "Support Portal",
  /** Support team email address that receives complaint notifications. */
  SUPPORT_STAFF_EMAIL: process.env.SUPPORT_STAFF_EMAIL || "",

  // ============================================
  // Mailjet — PRESERVED FOR FUTURE USE (currently disabled)
  // To switch back to Mailjet:
  //   1. Uncomment the variables below
  //   2. In mailer.ts, uncomment Mailjet code and comment Nodemailer code
  // ============================================
  // /** Mailjet API key for transactional email delivery. */
  // MAILJET_API_KEY: process.env.MAILJET_API_KEY || "",
  // /** Mailjet secret key paired with the API key. */
  // MAILJET_SECRET_KEY: process.env.MAILJET_SECRET_KEY || "",
  // /** Sender email address used when sending emails via Mailjet. */
  // MAILJET_SENDER_EMAIL: process.env.MAILJET_SENDER_EMAIL || "",
  // /** Display name shown as the sender in outgoing emails (Mailjet). */
  // MAILJET_SENDER_NAME: process.env.MAILJET_SENDER_NAME || "Support Portal",

  /** Number of minutes before an OTP code expires. */
  OTP_EXPIRY_MINUTES: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  /** Port the Express server listens on. */
  PORT: process.env.PORT || "5000",
  /** Frontend origin allowed by the CORS middleware. */
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  /** AWS region used for S3 file uploads. */
  AWS_REGION: process.env.AWS_REGION || "",
  /** S3 bucket name used for storing uploaded attachments. */
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || "",
};