// Astro 7 SSR on Cloudflare Workers. The request pipeline is composed in src/fetch.ts (Hono), see
// docs/KIT-PITFALLS.md "scaffold". Tailwind v4 comes in through its Vite plugin; design tokens are
// mapped in src/styles/global.css from /tokens.css (a byte copy, never edited).
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [react()],
  // Origin checks for state-changing requests are done in src/server/middleware/origin.ts for
  // every /api and /auth route; Astro pages take no form posts.
  // No Astro sessions: the adapter would otherwise inject a SESSION KV binding to provision.
  session: false,
  security: {
    checkOrigin: false,
    // Astro hashes its own inline hydration scripts and styles and sets the header itself on SSR
    // pages. The Hono layer sets the strict CSP on every response that has none (API, auth).
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ],
    },
  },
  vite: { plugins: [tailwindcss()] },
});
