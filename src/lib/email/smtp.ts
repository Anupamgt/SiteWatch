export async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
}): Promise<{ provider: string; messageId?: string; error?: string }> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { provider: "smtp", error: "SMTP_HOST is not set" };
  }
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
    });
    const info = await transporter.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return { provider: "smtp", messageId: info.messageId };
  } catch (err) {
    return {
      provider: "smtp",
      error: err instanceof Error ? err.message : "SMTP send failed",
    };
  }
}
