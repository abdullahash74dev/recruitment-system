// Thin wrapper around the Resend API (https://resend.com/docs/api-reference/emails/send-email).
// Every caller gets a result object instead of a thrown error, so a failed
// send can be recorded (applicant_emails.error_message) without crashing
// the whole request.
const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * RESEND_FROM_EMAIL should be set to e.g. "Your Company <no-reply@yourdomain.com>"
 * once your sending domain is verified in Resend. Until then this falls back
 * to Resend's own shared testing address, which works immediately (no domain
 * verification needed) but is rate-limited and shows as "via resend.dev".
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(input.text)}</pre>`,
      }),
    });
    const body = await res.json().catch(() => ({}) as any);
    if (!res.ok) {
      return { ok: false, error: body?.message || `Resend API error (${res.status})` };
    }
    return { ok: true, id: body?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
