// CORS allowlist: only APP_ORIGIN (and the request's own origin) may read /api responses from a
// browser. No wildcard, no credentials from other origins.
import type { MiddlewareHandler } from "hono";
import { allowedOrigins } from "./origin.js";

export function corsAllowlist(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const origin = c.req.header("Origin");
    const allowed = origin ? allowedOrigins(c.req.url, c.env?.APP_ORIGIN).has(origin) : false;
    // Only a real preflight (Access-Control-Request-Method present) is answered here; a bare OPTIONS
    // falls through to the route and gets its 405 (contract C2).
    if (c.req.method === "OPTIONS" && c.req.header("Access-Control-Request-Method")) {
      const headers = new Headers({ Vary: "Origin", "Cache-Control": "no-store" });
      if (origin && allowed) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
        headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Client-Platform, X-Client-Version");
        headers.set("Access-Control-Max-Age", "600");
      }
      c.res = new Response(null, { status: 204, headers });
      return;
    }
    await next();
    if (origin && allowed) {
      c.res.headers.set("Access-Control-Allow-Origin", origin);
      c.res.headers.append("Vary", "Origin");
    }
  };
}
