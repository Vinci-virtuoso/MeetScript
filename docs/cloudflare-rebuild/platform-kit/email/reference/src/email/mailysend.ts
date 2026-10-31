import type { EmailProvider, EmailMessage } from "./provider.js";

/**
 * Mailysend adapter, copied from minshop src/features/email/mailysend.ts. Mailysend is a
 * self-hosted, Resend-compatible email API on Cloudflare Workers (the live Worker is
 * `sei-mailysend`). Same wire format as Resend: `POST {base}/v1/emails` with a Bearer API key and an
 * optional `Idempotency-Key` (honoured for 24h).
 *
 * Transport: when the Worker has a `MAILYSEND` service binding to the Mailysend Worker it is used
 * (Worker to Worker, no public hop; a same-account `*.workers.dev` fetch can be refused otherwise).
 * Without the binding, a plain HTTPS fetch to the configured base URL is made.
 */
export interface MailysendFetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

/** Normalise a configured Mailysend base URL, or null when unusable. */
export function normalizeMailysendUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\/+$/, "").replace(/\/v1$/, "");
  if (!v) return null;
  try {
    const u = new URL(v);
    // The API key is sent to this host: only ever over TLS.
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) return null;
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return null;
  }
}

export function createMailysendEmail(
  apiKey: string,
  from: { email: string; name: string },
  opts: { baseUrl: string; binding?: MailysendFetcher | null },
): EmailProvider {
  const fromHeader = from.name ? `${from.name} <${from.email}>` : from.email;
  const endpoint = `${opts.baseUrl}/v1/emails`;
  const doFetch = (init: RequestInit) =>
    opts.binding ? opts.binding.fetch(new Request(endpoint, init)) : fetch(endpoint, init);
  return {
    async send(msg: EmailMessage): Promise<void> {
      const res = await doFetch({
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
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
        throw new Error(`Mailysend send failed (${res.status}): ${detail.slice(0, 500)}`);
      }
    },
  };
}
