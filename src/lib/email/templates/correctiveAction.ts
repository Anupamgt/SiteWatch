export function correctiveActionEmail(input: {
  siteName: string;
  reportDate?: string | null;
  taskCode?: string | null;
  plannedWork?: string | null;
  title: string;
  guidance?: string | null;
  priority: string;
  dueDate?: string | null;
  deepLink: string;
}): { subject: string; html: string; text: string } {
  const taskRef =
    input.taskCode || input.plannedWork
      ? [input.taskCode, input.plannedWork].filter(Boolean).join(" — ")
      : "—";

  const subject = `[SiteWatch] Corrective action: ${input.title}`;

  const text = [
    `Corrective action assigned`,
    ``,
    `Site: ${input.siteName}`,
    `Report date: ${input.reportDate ?? "—"}`,
    `Task: ${taskRef}`,
    `Title: ${input.title}`,
    `Priority: ${input.priority}`,
    `Due: ${input.dueDate ?? "—"}`,
    ``,
    `HO guidance:`,
    input.guidance || "(none)",
    ``,
    `Open in app: ${input.deepLink}`,
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Corrective action assigned</h2>
      <p><strong>Site:</strong> ${escapeHtml(input.siteName)}</p>
      <p><strong>Report date:</strong> ${escapeHtml(input.reportDate ?? "—")}</p>
      <p><strong>Task:</strong> ${escapeHtml(taskRef)}</p>
      <p><strong>Title:</strong> ${escapeHtml(input.title)}</p>
      <p><strong>Priority:</strong> ${escapeHtml(input.priority)}</p>
      <p><strong>Due:</strong> ${escapeHtml(input.dueDate ?? "—")}</p>
      <p><strong>HO guidance:</strong><br/>${escapeHtml(input.guidance || "(none)").replace(/\n/g, "<br/>")}</p>
      <p><a href="${escapeHtml(input.deepLink)}">Open in SiteWatch</a></p>
    </div>
  `;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
