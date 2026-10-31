/**
 * Email port (ports-and-adapters), copied from minshop src/features/email/provider.ts. App code
 * sends a message; the adapter (Mailysend, Resend, or the dev log) handles delivery.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Stable per-notification key (e.g. `receipt/<subscription id>`). Adapters that support
   * provider-side dedupe send it (Mailysend and Resend, 24h window). Optional so one-off sends
   * such as a login code (a new code every time) need not invent one.
   */
  idempotencyKey?: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<void>;
}
