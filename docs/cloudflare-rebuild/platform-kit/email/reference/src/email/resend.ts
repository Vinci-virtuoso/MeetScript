import type { EmailProvider, EmailMessage } from "./provider.js";

/**
 * Resend adapter, copied from minshop src/features/email/resend.ts: a plain HTTPS call to the
 * Resend API (same wire format as Mailysend). The fallback transport when RESEND_API_KEY is set.
 */
export function createResendEmail(apiKey: string, from: { email: string; name: string }): EmailProvider {
  const fromHeader = from.name ? `${from.name} <${from.email}>` : from.email;
  return {
    async send(msg: EmailMessage): Promise<void> {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          // Resend dedupes on this for 24h: a retry of an already delivered send is a no-op.
          ...(msg.idempotencyKey ? { "idempotency-key": msg.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Resend send failed (${res.status}): ${detail}`);
      }
    },
  };
}
