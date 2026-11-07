import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { z } from 'zod';
import { ApiError, hash, token } from './domain';
import type { Actor, Env } from './env';
export type AppContext = Context<{
  Bindings: Env;
  Variables: { actor: Actor; requestId: string };
}>;
const cookie = 'ms_refresh';
export async function identify(c: AppContext) {
  const bearer = c.req
    .header('Authorization')
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!bearer)
    throw new ApiError(401, 'sign_in_required', 'Sign in to continue.');
  const row = await c.env.DB.prepare(
    'SELECT u.id,u.email,s.id AS sessionId FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.access_hash=? AND s.revoked_at IS NULL AND s.access_expires_at>? AND s.expires_at>? AND u.verified_at IS NOT NULL',
  )
    .bind(await hash(bearer), Date.now(), Date.now())
    .first<Actor>();
  if (!row)
    throw new ApiError(
      401,
      'session_expired',
      'Your session expired. Sign in again.',
    );
  c.set('actor', row);
  return row;
}
export async function limited(
  db: D1Database,
  key: string,
  max: number,
  windowMs: number,
) {
  const now = Date.now();
  const result = await db
    .prepare(
      'INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count',
    )
    .bind(key, now + windowMs, now, now)
    .first<{ count: number }>();
  if (!result || result.count > max)
    throw new ApiError(
      429,
      'rate_limited',
      'Too many attempts. Try again later.',
    );
}
async function challenge(c: AppContext, value: string) {
  if (c.env.ENVIRONMENT === 'local') return;
  if (!c.env.TURNSTILE_SECRET)
    throw new ApiError(
      503,
      'authentication_unavailable',
      'Abuse protection is not configured.',
    );
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: new URLSearchParams({
        secret: c.env.TURNSTILE_SECRET,
        response: value,
        remoteip: c.req.header('CF-Connecting-IP') ?? '',
      }),
    },
  );
  const result = (await response.json()) as {
    success: boolean;
    hostname?: string;
    action?: string;
  };
  if (
    !result.success ||
    result.hostname !== new URL(c.env.APP_ORIGIN).hostname ||
    result.action !== 'sign-in'
  )
    throw new ApiError(
      400,
      'challenge_failed',
      'Complete the verification challenge.',
    );
}
export async function sendCode(c: AppContext) {
  const body = z
    .object({
      email: z
        .email()
        .max(254)
        .transform((e) => e.toLowerCase()),
      turnstileToken: z.string().max(2048).default(''),
    })
    .parse(await c.req.json());
  await challenge(c, body.turnstileToken);
  await limited(c.env.DB, `send:${await hash(body.email)}`, 3, 900000);
  await limited(
    c.env.DB,
    `send-ip:${await hash(c.req.header('CF-Connecting-IP') ?? 'local')}`,
    10,
    900000,
  );
  if (!c.env.MAILER)
    throw new ApiError(
      503,
      'delivery_unavailable',
      'Sign-in email delivery is not configured. Sample meetings remain available.',
    );
  const id = crypto.randomUUID(),
    code = String(
      crypto.getRandomValues(new Uint32Array(1))[0] % 1000000,
    ).padStart(6, '0');
  await c.env.DB.prepare(
    'INSERT INTO otp_challenges(id,email,code_hash,expires_at) VALUES(?,?,?,?)',
  )
    .bind(id, body.email, await hash(`${id}:${code}`), Date.now() + 600000)
    .run();
  const delivered = await c.env.MAILER.fetch(
    'https://auth-mailer.internal/send',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: body.email,
        template: 'meetscript-otp',
        code,
        expiresMinutes: 10,
      }),
    },
  );
  if (!delivered.ok) {
    await c.env.DB.prepare('DELETE FROM otp_challenges WHERE id=?')
      .bind(id)
      .run();
    throw new ApiError(
      503,
      'delivery_unavailable',
      'Email could not be delivered. Try again later.',
    );
  }
  return c.json({ challengeId: id, expiresIn: 600 });
}
async function issue(c: AppContext, userId: string) {
  const accessToken = token(),
    refreshToken = token(),
    id = crypto.randomUUID(),
    now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO sessions(id,user_id,access_hash,refresh_hash,access_expires_at,expires_at) VALUES(?,?,?,?,?,?)',
  )
    .bind(
      id,
      userId,
      await hash(accessToken),
      await hash(refreshToken),
      now + 900000,
      now + 2592000000,
    )
    .run();
  setCookie(c, cookie, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/auth/web',
    maxAge: 2592000,
  });
  return c.json({ accessToken, expiresIn: 900 });
}
export async function verifyCode(c: AppContext) {
  const body = z
    .object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
    .parse(await c.req.json());
  await limited(
    c.env.DB,
    `verify-ip:${await hash(c.req.header('CF-Connecting-IP') ?? 'local')}`,
    30,
    900000,
  );
  const row = await c.env.DB.prepare(
    'UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND used_at IS NULL AND expires_at>? AND attempts<5 RETURNING email,code_hash',
  )
    .bind(body.challengeId, Date.now())
    .first<{ email: string; code_hash: string }>();
  if (
    !row ||
    row.code_hash !== (await hash(`${body.challengeId}:${body.code}`))
  )
    throw new ApiError(
      400,
      'invalid_code',
      'Code is invalid, expired, or already used.',
    );
  const used = await c.env.DB.prepare(
    'UPDATE otp_challenges SET used_at=? WHERE id=? AND used_at IS NULL RETURNING id',
  )
    .bind(Date.now(), body.challengeId)
    .first();
  if (!used)
    throw new ApiError(400, 'invalid_code', 'Code has already been used.');
  await c.env.DB.prepare(
    'INSERT INTO users(id,email,verified_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING',
  )
    .bind(crypto.randomUUID(), row.email, Date.now())
    .run();
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email=?')
    .bind(row.email)
    .first<{ id: string }>();
  return issue(c, user!.id);
}
export async function refresh(c: AppContext) {
  const raw = getCookie(c, cookie);
  if (!raw) return c.body(null, 204);
  const accessToken = token(),
    refreshToken = token(),
    now = Date.now();
  const row = await c.env.DB.prepare(
    'UPDATE sessions SET refresh_hash=?,access_hash=?,access_expires_at=? WHERE refresh_hash=? AND revoked_at IS NULL AND expires_at>? RETURNING id',
  )
    .bind(
      await hash(refreshToken),
      await hash(accessToken),
      now + 900000,
      await hash(raw),
      now,
    )
    .first();
  if (!row) {
    deleteCookie(c, cookie, { path: '/auth/web', secure: true });
    throw new ApiError(
      401,
      'session_expired',
      'Session expired. Sign in again.',
    );
  }
  setCookie(c, cookie, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/auth/web',
    maxAge: 2592000,
  });
  return c.json({ accessToken, expiresIn: 900 });
}
export async function logout(c: AppContext) {
  const raw = getCookie(c, cookie);
  if (raw)
    await c.env.DB.prepare(
      'UPDATE sessions SET revoked_at=? WHERE refresh_hash=?',
    )
      .bind(Date.now(), await hash(raw))
      .run();
  deleteCookie(c, cookie, { path: '/auth/web', secure: true });
  return c.body(null, 204);
}
