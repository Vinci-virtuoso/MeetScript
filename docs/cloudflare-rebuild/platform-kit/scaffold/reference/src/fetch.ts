// The Worker request pipeline (Astro 7 `fetchFile`): Hono first, Astro pages last.
//
// Astro's Cloudflare entry (`@astrojs/cloudflare/entrypoints/server`) already served static assets
// and calls this app as `fetch(request)` with NO env and NO ExecutionContext. So: bindings come from
// `cloudflare:workers`, `waitUntil` comes from Astro's render options on the FetchState, and the
// adapter's `cf()` Hono middleware is NOT used here (it would run the asset lookup a second time
// with an undefined env). See docs/KIT-PITFALLS.md "scaffold".
import { env as workerEnv } from "cloudflare:workers";
import { actions, getFetchState, middleware, notFound, pages, redirects, trailingSlash } from "astro/hono";
import { createApp } from "./server/app.js";

const app = createApp({
  fallbackEnv: () => workerEnv as unknown as Env,
  prepare: async (c, next) => {
    const state = getFetchState(c);
    const waitUntil = state.renderOptions?.waitUntil;
    if (waitUntil) c.set("waitUntil", (promise) => waitUntil(promise));
    await next();
  },
});
app.use(trailingSlash());
app.use(redirects());
app.use(notFound());
app.use(actions());
app.use(middleware());
app.use(pages());

export default app;
