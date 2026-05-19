import { Resend } from 'resend';
import { pool } from '../db.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'onboarding@resend.dev';

export async function sendEmail({ to, subject, html, type, projectId = null }) {
  let messageId = null;
  let status = 'sent';
  let errorMessage = null;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html
    });

    if (error) throw new Error(error.message);
    messageId = data?.id ?? null;
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
    console.error(`[emailService] Failed to send to ${to}:`, err.message);
  }

  await pool.query(
    `INSERT INTO admin_console.email_log
       (type, recipient_email, subject, resend_message_id, status, error_message, project_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [type, to, subject, messageId, status, errorMessage, projectId]
  );

  return { status, messageId, to };
}

export async function sendBatch(emails) {
  return Promise.all(emails.map(e => sendEmail(e)));
}
