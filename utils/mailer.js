import nodemailer from "nodemailer";

// SMTP comes entirely from env so no credentials live in the repo. Callers check
// mailerConfigured() first and report "not configured" explicitly, rather than letting an
// unconfigured server fail with a generic 500 that looks like a bug.
let transporter = null;

export function mailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getTransporter() {
  if (!mailerConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 is implicit TLS; 587 upgrades via STARTTLS. Overridable for odd providers.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}
