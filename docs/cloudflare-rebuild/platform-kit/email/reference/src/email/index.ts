// The email seam. Primary: Mailysend through the MAILYSEND service binding (HTTPS fallback to
// MAILYSEND_API_URL). Fallback: Resend. Without a key the dev transport writes to the log, so the
// app still signs people in locally and in a preview with no mail key (noted in KIT-REPORT.md).
import { createDevEmail } from "./dev.js";
import { createMailysendEmail, normalizeMailysendUrl } from "./mailysend.js";
import type { EmailProvider } from "./provider.js";
import { createResendEmail } from "./resend.js";

export type { EmailMessage, EmailProvider } from "./provider.js";

export type EmailTransport = "mailysend" | "resend" | "dev";

export interface EmailEnv {
  EMAIL_FROM?: string;
  MAILYSEND_API_URL?: string;
  MAILYSEND_API_KEY?: string;
  MAILYSEND?: { fetch(input: Request | string, init?: RequestInit): Promise<Response> } | null;
  RESEND_API_KEY?: string;
}

/** `"Name <addr>"` or `"addr"` into the adapter's from shape. */
export function parseFrom(value: string | undefined): { email: string; name: string } {
  const raw = (value ?? "").trim();
  const match = /^(.*?)\s*<([^>]+)>$/.exec(raw);
  if (match) return { name: match[1]!.trim().replace(/^"|"$/g, ""), email: match[2]!.trim() };
  return { name: "", email: raw || "login@rent-split.local" };
}

export function emailTransport(env: EmailEnv): EmailTransport {
  if (env.MAILYSEND_API_KEY && normalizeMailysendUrl(env.MAILYSEND_API_URL)) return "mailysend";
  if (env.RESEND_API_KEY) return "resend";
  return "dev";
}

export function createEmailProvider(env: EmailEnv): EmailProvider {
  const from = parseFrom(env.EMAIL_FROM);
  switch (emailTransport(env)) {
    case "mailysend":
      return createMailysendEmail(env.MAILYSEND_API_KEY!, from, {
        baseUrl: normalizeMailysendUrl(env.MAILYSEND_API_URL)!,
        binding: env.MAILYSEND ?? null,
      });
    case "resend":
      return createResendEmail(env.RESEND_API_KEY!, from);
    default:
      return createDevEmail(from);
  }
}
