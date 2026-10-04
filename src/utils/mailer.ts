/**
 * @file Email delivery utilities using Nodemailer (Gmail SMTP).
 *
 * Provides helpers to send OTP recovery emails and complaint notification
 * emails via SMTP (Gmail). When SMTP credentials are not configured,
 * emails are logged to the console for local development.
 *
 * ============================================
 * ACTIVE PROVIDER: Gmail SMTP (Nodemailer)
 * ============================================
 *
 * ============================================
 * ALTERNATIVE PROVIDER: Mailjet (preserved below)
 * To switch back to Mailjet:
 *   1. Comment out the Nodemailer code below (sections marked ACTIVE)
 *   2. Uncomment the Mailjet code (sections marked MAILJET)
 *   3. Uncomment Mailjet env vars in config/env.ts
 *   4. Add Mailjet env vars to .env file
 * ============================================
 */

// ============================================
// Gmail SMTP (Nodemailer) — ACTIVE CODE
// ============================================

import nodemailer from "nodemailer";
import { env } from "../config/env";

/** Whether SMTP credentials are available for sending real emails. */
const hasSmtp = env.EMAIL_USER && env.EMAIL_PASS;

/** Nodemailer transport instance, or null when credentials are missing. */
const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    })
  : null;

/**
 * Send an OTP recovery email to the specified address.
 *
 * @param toEmail - Recipient email address.
 * @param otp - The one-time password to include in the email body.
 */
export async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  if (!transporter) {
    console.log(`[DEV] OTP for ${toEmail}: ${otp}`);
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#0f2c74;margin:0 0 12px;">Sharp Minds Support Portal</h2>
      <p style="color:#333;margin:0 0 16px;">Use the OTP below to recover your account. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.</p>
      <div style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#52c41a;text-align:center;padding:16px;background:#f6ffed;border-radius:8px;">
        ${otp}
      </div>
      <p style="color:#666;margin-top:16px;font-size:12px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Sharp Minds account recovery OTP",
    html,
    text: `Your Sharp Minds recovery OTP is ${otp}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
  });
}

/**
 * Send a complaint-creation notification email to the support team.
 *
 * @param data - Complaint details to include in the notification.
 * @param data.ticketId - Unique ticket identifier.
 * @param data.title - Short description of the complaint.
 * @param data.description - Full complaint description.
 * @param data.module - Application module the complaint relates to.
 * @param data.feature - Specific feature within the module.
 * @param data.customerEmail - Email of the customer who filed the complaint.
 * @param data.customerName - Display name of the customer who filed the complaint.
 */
export async function sendComplaintNotificationEmail(data: {
  ticketId: string;
  title: string;
  description: string;
  module: string;
  feature: string;
  customerEmail: string;
  customerName?: string;
}): Promise<void> {
  const supportEmail = env.SUPPORT_STAFF_EMAIL;
  if (!supportEmail) {
    console.warn(
      `[mailer] SUPPORT_STAFF_EMAIL not configured; skipping complaint notification for ticket ${data.ticketId}`
    );
    return;
  }

  if (!transporter) {
    console.log(`[DEV] Complaint notification → ${supportEmail}: ${data.ticketId} - ${data.title}`);
    return;
  }

  const ticketUrl = `${env.CLIENT_ORIGIN}/complaints/${data.ticketId}`;
  const customerName = data.customerName || data.customerEmail.split("@")[0] || "Customer";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#0f2c74;margin:0 0 12px;">New Complaint Registered</h2>
      <p style="color:#333;margin:0 0 16px;">A new complaint has been submitted on the Support Portal.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
        <tr>
          <td style="padding:8px 0;font-weight:600;width:120px;">Ticket ID</td>
          <td style="padding:8px 0;">${data.ticketId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Title</td>
          <td style="padding:8px 0;">${data.title}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Module</td>
          <td style="padding:8px 0;">${data.module}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Feature</td>
          <td style="padding:8px 0;">${data.feature}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Customer</td>
          <td style="padding:8px 0;">${customerName} (${data.customerEmail})</td>
        </tr>
      </table>
      <a href="${ticketUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#52c41a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Complaint</a>
      <p style="color:#666;margin-top:16px;font-size:12px;">This is an automated notification from Sharp Minds Support Portal.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_USER}>`,
    to: supportEmail,
    subject: `[New Complaint] ${data.ticketId} - ${data.title}`,
    html,
    text: `New complaint registered.\nTicket: ${data.ticketId}\nTitle: ${data.title}\nModule: ${data.module}\nFeature: ${data.feature}\nCustomer: ${customerName} (${data.customerEmail})\nView complaint: ${ticketUrl}`,
  });
}


// ============================================
// Mailjet — PRESERVED CODE (currently disabled)
// ============================================
// To switch back to Mailjet:
//   1. Uncomment the Mailjet import below
//   2. Uncomment the Mailjet client setup below
//   3. Comment out the Nodemailer import and transporter above
//   4. Replace the sendOtpEmail and sendComplaintNotificationEmail
//      functions with the Mailjet versions below
//   5. Uncomment Mailjet env vars in config/env.ts
//   6. Add Mailjet env vars to .env file
// ============================================

/*
import Mailjet from "node-mailjet";

const hasMailjet = env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY;

const mailjet = hasMailjet
  ? Mailjet.apiConnect(env.MAILJET_API_KEY, env.MAILJET_SECRET_KEY)
  : null;

export async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  if (!mailjet) {
    console.log(`[DEV] OTP for ${toEmail}: ${otp}`);
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#0f2c74;margin:0 0 12px;">Sharp Minds Support Portal</h2>
      <p style="color:#333;margin:0 0 16px;">Use the OTP below to recover your account. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.</p>
      <div style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#52c41a;text-align:center;padding:16px;background:#f6ffed;border-radius:8px;">
        ${otp}
      </div>
      <p style="color:#666;margin-top:16px;font-size:12px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: env.MAILJET_SENDER_EMAIL,
          Name: env.MAILJET_SENDER_NAME,
        },
        To: [{ Email: toEmail }],
        Subject: "Your Sharp Minds account recovery OTP",
        HTMLPart: html,
        TextPart: `Your Sharp Minds recovery OTP is ${otp}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
      },
    ],
  });

  await request;
}

const SUPPORT_EMAIL = "surajrai133139@gmail.com";

export async function sendComplaintNotificationEmail(data: {
  ticketId: string;
  title: string;
  description: string;
  module: string;
  feature: string;
  customerEmail: string;
}): Promise<void> {
  if (!mailjet) {
    console.log(`[DEV] Complaint notification → ${SUPPORT_EMAIL}: ${data.ticketId} - ${data.title}`);
    return;
  }

  const dashboardUrl = `${env.CLIENT_ORIGIN}/complaints/${data.ticketId}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <h2 style="color:#0f2c74;margin:0 0 12px;">New Complaint Registered</h2>
      <p style="color:#333;margin:0 0 16px;">A new complaint has been submitted on the Support Portal.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
        <tr>
          <td style="padding:8px 0;font-weight:600;width:120px;">Ticket ID</td>
          <td style="padding:8px 0;">${data.ticketId}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Title</td>
          <td style="padding:8px 0;">${data.title}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Module</td>
          <td style="padding:8px 0;">${data.module}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Feature</td>
          <td style="padding:8px 0;">${data.feature}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:600;">Customer</td>
          <td style="padding:8px 0;">${data.customerEmail}</td>
        </tr>
      </table>
      <a href="${dashboardUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#52c41a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Complaint</a>
      <p style="color:#666;margin-top:16px;font-size:12px;">This is an automated notification from Sharp Minds Support Portal.</p>
    </div>
  `;

  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: env.MAILJET_SENDER_EMAIL,
          Name: env.MAILJET_SENDER_NAME,
        },
        To: [{ Email: SUPPORT_EMAIL }],
        Subject: `[New Complaint] ${data.ticketId} - ${data.title}`,
        HTMLPart: html,
        TextPart: `New complaint registered.\\nTicket: ${data.ticketId}\\nTitle: ${data.title}\\nModule: ${data.module}\\nFeature: ${data.feature}\\nCustomer: ${data.customerEmail}\\nView complaint: ${dashboardUrl}`,
      },
    ],
  });

  await request;
}
*/
