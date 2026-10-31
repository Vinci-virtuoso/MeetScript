// The Workers Rate Limiting binding in front of the code endpoints (loginbase keeps its own KV
// counters per email and per IP; this is the cheap edge layer per IP, 10 a minute).
import type { MiddlewareHandler } from "hono";
import { ApiError } from "../http.js";
import { clientIp } from "../client-ip.js";
import { errorFields, log } from "../log.js";

export function authRateLimit(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const key = clientIp(c.req.raw, c.env);
    let success = true;
    try {
      ({ success } = await c.env.AUTH_RATE_LIMITER.limit({ key }));
    } catch (err) {
      log("warn", "auth_rate_limiter", errorFields(err));
    }
    if (!success) {
      throw new ApiError(
        429,
        "too_many_requests",
        "Too many attempts from this network; try again in a minute.",
        { retryAfterSeconds: 60 },
        { "Retry-After": "60" },
      );
    }
    await next();
  };
}
