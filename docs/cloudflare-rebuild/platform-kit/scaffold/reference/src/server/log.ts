// Structured logs: one JSON object per line. Never log bodies, IPs, emails, tokens, share ids,
// names or amounts. `ts`, `level` and `msg` come first, then the fields in their own order.

export type Level = "info" | "warn" | "error";

export function log(level: Level, msg: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** The request id: the `cf-ray` header or a random UUID. */
export function requestId(request: Request): string {
  return request.headers.get("cf-ray") || crypto.randomUUID();
}

/** The one line written when a request finishes. */
export function requestLog(request: Request, status: number, ms: number, rid?: string): void {
  log("info", "request", {
    rid: rid ?? requestId(request),
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    ms: Math.round(ms),
  });
}

export function errorFields(err: unknown): { err: string; stack: string } {
  const error = err instanceof Error ? err : new Error(String(err));
  return { err: error.message, stack: error.stack ?? "" };
}
