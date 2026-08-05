export async function sendViaConsole(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ provider: string; messageId?: string; error?: string }> {
  console.log("\n========== EMAIL (console driver) ==========");
  console.log(`To: ${opts.to}`);
  console.log(`Subject: ${opts.subject}`);
  console.log("--- text ---");
  console.log(opts.text);
  console.log("--- html ---");
  console.log(opts.html);
  console.log("============================================\n");
  return { provider: "console", messageId: `console-${Date.now()}` };
}
