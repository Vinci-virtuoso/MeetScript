// requireUser(): Bearer access JWT -> the users row on `c.get("user")`. requirePlan("pro"): the
// user must pass the pro.use policy. Both answer with the platform error envelope.
import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "loginbase";
import { findUserById, type User } from "../../db/index.js";
import { can } from "../../policy/can.js";
import { ApiError } from "../http.js";

export type AuthVariables = { user: User; sessionId: string };

export function requireUser(): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) throw new ApiError(401, "unauthorized", "Sign in to use this route.");
    if (!c.env.JWT_SECRET) throw new ApiError(500, "misconfigured", "JWT_SECRET is not set.");
    let payload: { sub?: string; sid?: string };
    try {
      payload = await verifyAccessToken(c.env.JWT_SECRET, header.slice(7));
    } catch {
      throw new ApiError(401, "invalid_token", "Your session expired. Sign in again.");
    }
    const user = payload.sub ? await findUserById(c.env.DB, payload.sub) : null;
    if (!user) throw new ApiError(401, "invalid_token", "This account no longer exists. Sign in again.");
    c.set("user", user);
    c.set("sessionId", payload.sid ?? "");
    await next();
  };
}

export function requirePlan(plan: "pro"): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw new ApiError(401, "unauthorized", "Sign in to use this route.");
    if (!can(user, "pro.use")) {
      throw new ApiError(403, "plan_required", "This needs the Pro plan.", { plan });
    }
    await next();
  };
}
