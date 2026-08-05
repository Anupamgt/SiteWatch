import { sendViaConsole } from "./console";
import { sendViaResend } from "./resend";
import { sendViaSmtp } from "./smtp";

export type SendEmailResult = {
  provider: string;
  messageId?: string;
  error?: string;
};

/**
 * Never throws — callers always get a result so corrective-action creation
 * can return 201 even when delivery fails (invariant I5).
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const from = process.env.MAIL_FROM || "SiteWatch <dpr@example.com>";

  if (provider === "resend") {
    return sendViaResend({ ...opts, from });
  }
  if (provider === "smtp") {
    return sendViaSmtp({ ...opts, from });
  }
  return sendViaConsole(opts);
}
