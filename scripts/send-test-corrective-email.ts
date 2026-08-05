/**
 * Send a one-off corrective-action style email using the app's email drivers.
 *
 * Usage:
 *   npx tsx scripts/send-test-corrective-email.ts you@gmail.com
 *
 * Uses EMAIL_PROVIDER / MAIL_FROM / RESEND_* or SMTP_* from .env
 * (same path as POST /api/corrective-actions).
 */
import { sendEmail } from "../src/lib/email";
import { correctiveActionEmail } from "../src/lib/email/templates/correctiveAction";

async function main() {
  const to = (process.argv[2] || "").trim().toLowerCase();
  if (!to) {
    console.error("Usage: npx tsx scripts/send-test-corrective-email.ts <to-email>");
    process.exit(1);
  }

  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const template = correctiveActionEmail({
    siteName: "Bijapur Site (test)",
    reportDate: new Date().toISOString().slice(0, 10),
    taskCode: "T-TEST",
    plannedWork: "Mail pipeline smoke test",
    title: "Test corrective action email",
    guidance: "If you received this, SiteWatch email delivery is working.",
    priority: "MEDIUM",
    dueDate: new Date().toISOString().slice(0, 10),
    deepLink: `${baseUrl}/my/corrective-actions`,
  });

  console.log(`Provider: ${provider}`);
  console.log(`From:     ${process.env.MAIL_FROM || "SiteWatch <dpr@example.com>"}`);
  console.log(`To:       ${to}`);
  console.log(`Subject:  ${template.subject}`);

  const result = await sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  if (result.error) {
    console.error("FAILED:", result);
    process.exit(1);
  }

  console.log("SENT:", result);
  if (provider === "console") {
    console.log(
      "\nEMAIL_PROVIDER is still 'console' — mail was only printed above, not delivered.\n" +
        "Set EMAIL_PROVIDER=resend (RESEND_API_KEY) or EMAIL_PROVIDER=smtp (SMTP_*) then re-run."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
