// CSRF guard for state-changing requests. Cookie-authenticated routes (/auth/web/*) must carry a
// same-origin Origin header: a browser always sends it on a cross-site or same-origin fetch POST.
// Other /api and /auth routes reject a foreign Origin when one is present and accept its absence
// (Bearer clients such as curl never send one, and the webhook is signed instead).
import type { MiddlewareHandler } from "hono";
import { ApiError } from "../http.js";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function allowedOrigins(requestUrl: string, appOrigin: string | undefined): Set<string> {
  const set = new Set<string>([new URL(requestUrl).origin]);
  if (appOrigin) {
    try {
      set.add(new URL(appOrigin).origin);
    } catch {
      // a malformed APP_ORIGIN never widens the allowlist
    }
  }
  return set;
}

export function originCheck(options: { requireOrigin?: boolean; exempt?: (path: string) => boolean } = {}): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (!STATE_CHANGING.has(c.req.method) || options.exempt?.(path)) return next();
    const origin = c.req.header("Origin");
    const allowed = allowedOrigins(c.req.url, c.env?.APP_ORIGIN);
    if (origin) {
      if (!allowed.has(origin)) {
        throw new ApiError(403, "forbidden_origin", "This request came from another site.");
      }
    } else if (options.requireOrigin) {
      throw new ApiError(403, "origin_required", "Send this request from the app page.");
    } else if (c.req.header("Sec-Fetch-Site") === "cross-site") {
      throw new ApiError(403, "forbidden_origin", "This request came from another site.");
    }
    await next();
  };
}
