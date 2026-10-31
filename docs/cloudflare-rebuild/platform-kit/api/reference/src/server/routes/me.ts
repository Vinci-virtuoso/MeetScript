// GET /api/me: the signed-in user. The first call every page makes after the refresh.
import { Hono } from "hono";
import { requireUser, type AuthVariables } from "../auth/require-user.js";
import { publicUser } from "../auth/login.js";
import { jsonResponse } from "../http.js";

export const meRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

meRoutes.get("/api/me", requireUser(), (c) => jsonResponse({ user: publicUser(c.get("user")) }));
