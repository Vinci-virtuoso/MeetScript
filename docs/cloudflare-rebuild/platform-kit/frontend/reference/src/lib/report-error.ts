// The error boundary's report. No user data; the server truncates and logs it as one warn line.
import type { ClientError } from "../schemas/client-error.js";

export function reportClientError(report: ClientError): void {
  try {
    const body = JSON.stringify({ ...report, url: typeof location === "undefined" ? undefined : location.pathname });
    void fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
  } catch {
    // reporting must never throw
  }
}
