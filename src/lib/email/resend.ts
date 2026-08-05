export async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
}): Promise<{ provider: string; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { provider: "resend", error: "RESEND_API_KEY is not set" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (result.error) {
      return { provider: "resend", error: result.error.message };
    }
    return { provider: "resend", messageId: result.data?.id };
  } catch (err) {
    return {
      provider: "resend",
      error: err instanceof Error ? err.message : "Resend send failed",
    };
  }
}
