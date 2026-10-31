// The dev transport: writes the message to the log and keeps the last few in memory so the local
// test harness can read a login code back (GET /api/dev/mail, only when DEV_MAIL_PEEK is "1",
// which the deploy envs never set). The log line never contains the html or the text body in full:
// it carries the recipient, the subject and the first line of the text so a developer can read the
// code off `wrangler dev`.
import type { EmailMessage, EmailProvider } from "./provider.js";

export interface DevMail extends EmailMessage {
  at: number;
}

const KEEP = 20;
const outbox: DevMail[] = [];

export function devOutbox(to?: string): DevMail[] {
  const list = to ? outbox.filter((m) => m.to === to.trim().toLowerCase()) : outbox;
  return [...list].reverse();
}

export function clearDevOutbox(): void {
  outbox.length = 0;
}

export function createDevEmail(from: { email: string; name: string }): EmailProvider {
  return {
    async send(msg: EmailMessage): Promise<void> {
      const mail: DevMail = { ...msg, to: msg.to.trim().toLowerCase(), at: Date.now() };
      outbox.push(mail);
      if (outbox.length > KEEP) outbox.splice(0, outbox.length - KEEP);
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          msg: "email_dev",
          from: from.name ? `${from.name} <${from.email}>` : from.email,
          to: mail.to,
          subject: msg.subject,
          firstLine: msg.text.split("\n").find((l) => l.trim()) ?? "",
        }),
      );
    },
  };
}
