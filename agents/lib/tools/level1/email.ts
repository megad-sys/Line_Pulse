export type EmailToolInput = {
  supervisor_email: string;
  subject: string;
  body: string;
};

export type EmailToolResult = {
  success: boolean;
  message: string;
  error?: string;
};

export async function runEmailTool(input: EmailToolInput): Promise<EmailToolResult> {
  if (!input.supervisor_email) {
    return {
      success: false,
      message: "",
      error: "No alert email configured. Go to Settings → Notifications to add a recipient.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, message: "", error: "RESEND_API_KEY not configured." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "alerts@linepulse.io",
      to: [input.supervisor_email],
      subject: input.subject,
      text: input.body,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    return { success: false, message: "", error: err.message ?? `Resend HTTP ${res.status}` };
  }

  return { success: true, message: `Alert emailed to ${input.supervisor_email}` };
}
