// loginbase, configured once per env: email OTP, GitHub OAuth, 15 minute access JWTs, 30 day
// sliding refresh sessions, statistics into eventbase's `events` table and the raw funnel into
// auth_events. `onVerified` is the only place that creates a users row.
import { createLogin, type LoginConfig } from "loginbase";
import { deleteUserCascade, findOrCreateUser, findUserById, recordAuthEvent } from "../../db/index.js";
import { createEmailProvider } from "../../email/index.js";
import { currentRequest, deferred } from "../context.js";
import { log } from "../log.js";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_BASE = "/auth";
export const WEB_GITHUB_DONE_PATH = "/auth/web/github/done";
export const GITHUB_CALLBACK_PATH = "/auth/oauth/github/callback";

export function appOrigin(env: Env): string {
  return (env.APP_ORIGIN || "http://127.0.0.1:8787").replace(/\/+$/, "");
}

/** The exact callback URL the GitHub OAuth app must list (written into docs/KIT-REPORT.md). */
export function githubCallbackUrl(env: Env): string {
  return `${appOrigin(env)}${GITHUB_CALLBACK_PATH}`;
}

export function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET);
}

export function publicUser(user: { id: string; email: string; plan: string; proUntil: number | null }) {
  return { id: user.id, email: user.email, plan: user.plan, proUntil: user.proUntil };
}

function resolveConfig(env: Env): LoginConfig {
  if (!env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  const email = createEmailProvider(env);
  const config: LoginConfig = {
    db: env.DB,
    kv: env.AUTH_KV,
    jwt: { secret: env.JWT_SECRET, accessTtlSeconds: ACCESS_TTL_SECONDS },
    session: { refreshTtlMs: REFRESH_TTL_MS },
    stats: { db: env.DB },
    email: {
      send: (message) => email.send({ to: message.to, subject: message.subject, html: message.html, text: message.text }),
      from: env.EMAIL_FROM || "rent-split <login@rent-split.local>",
      brand: "rent-split",
      fallbackLocale: "en",
    },
    async onVerified(identity) {
      const { user, created } = await findOrCreateUser(env.DB, identity.email, {
        githubId: identity.provider === "github" ? identity.providerUserId : undefined,
      });
      return { userId: user.id, isNewUser: created, user: publicUser(user) };
    },
    onEvent(event) {
      // Never log tokens or codes: loginbase's events carry neither. Emails are not in them either.
      log("info", "auth_event", { rid: currentRequest()?.rid ?? "", ...event });
      deferred(recordAuthEvent(env.DB, event, currentRequest()?.cf ?? {}));
    },
    accountDeletion: {
      emailOf: async (userId) => (await findUserById(env.DB, userId))?.email ?? null,
      onDelete: async ({ userId }) => deleteUserCascade(env.DB, userId),
    },
  };
  if (githubConfigured(env)) {
    config.socials = {
      github: {
        clientId: env.GITHUB_OAUTH_CLIENT_ID!,
        clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET!,
        allowedRedirects: [`${appOrigin(env)}${WEB_GITHUB_DONE_PATH}`],
        callbackUrl: githubCallbackUrl(env),
      },
    };
  }
  return config;
}

export const login = createLogin<Env>(resolveConfig, { basePath: AUTH_BASE });
