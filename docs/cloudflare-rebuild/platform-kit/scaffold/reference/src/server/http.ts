// The one error envelope for every /api and /auth response: loginbase's shape
// `{ "error": "<code>", ...fields }` plus a plain `message` sentence. Routes throw ApiError; the
// app-level onError turns it into JSON. Unknown errors become 500 `internal`.

export const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** Headers every response carries. The CSP is only set when the response has none (Astro sets its own). */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
});

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, unknown> = {},
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorBody(code: string, message: string, fields: Record<string, unknown> = {}) {
  return { error: code, message, ...fields };
}

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const all = new Headers(headers);
  all.set("Content-Type", "application/json; charset=utf-8");
  all.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: all });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  fields: Record<string, unknown> = {},
  headers?: HeadersInit,
): Response {
  return jsonResponse(errorBody(code, message, fields), status, headers);
}

export function emptyResponse(status: number, headers?: HeadersInit): Response {
  const all = new Headers(headers);
  all.set("Cache-Control", "no-store");
  return new Response(null, { status, headers: all });
}
