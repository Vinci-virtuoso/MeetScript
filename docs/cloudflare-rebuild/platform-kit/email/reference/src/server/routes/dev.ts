// GET /api/dev/mail?to=: the dev transport's outbox, so the local harness can read a login code.
// Only answers when the DEV_MAIL_PEEK var is "1", which only the top-level (local) wrangler config
// sets; the preview and production envs never do, so this is a 404 there.
import { Hono } from "hono";
import { devOutbox } from "../../email/dev.js";
import { ApiError, jsonResponse } from "../http.js";

export const devRoutes = new Hono<{ Bindings: Env }>();

devRoutes.get("/api/dev/mail", (c) => {
  if ((c.env as Env & { DEV_MAIL_PEEK?: string }).DEV_MAIL_PEEK !== "1") {
    throw new ApiError(404, "not_found", "There is no API route at this path.");
  }
  const to = c.req.query("to") ?? undefined;
  return jsonResponse({ messages: devOutbox(to).map(({ html: _html, ...rest }) => rest) });
});
