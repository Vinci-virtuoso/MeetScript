import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import { ApiError, joinSchema, normalizeMeetUrl } from './domain';
import {
  identify,
  sendCode,
  verifyCode,
  refresh,
  logout,
  limited,
} from './auth';
import { Repository } from './repository';
import type { Actor, Env } from './env';
export const app = new Hono<{
  Bindings: Env;
  Variables: { actor: Actor; requestId: string };
}>();
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Request-Id', c.get('requestId'));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin !== c.env.APP_ORIGIN)
      throw new ApiError(
        403,
        'forbidden_origin',
        'Send this request from the app.',
      );
    const length = Number(c.req.header('Content-Length') ?? 0);
    if (length > 65536)
      throw new ApiError(
        413,
        'request_too_large',
        'Request exceeds the limit.',
      );
    if (c.req.raw.body) {
      const reader = c.req.raw.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let bytes = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 65536) {
          await reader.cancel();
          throw new ApiError(
            413,
            'request_too_large',
            'Request exceeds the limit.',
          );
        }
        chunks.push(part.value);
      }
      c.req.raw = new Request(c.req.raw, { body: new Blob(chunks) });
    }
  }
  await next();
});
app.onError((e, c) => {
  if (e instanceof ApiError)
    return c.json(
      { error: e.code, message: e.message, requestId: c.get('requestId') },
      e.status as 400,
    );
  if (e instanceof ZodError || e instanceof SyntaxError)
    return c.json(
      {
        error: 'invalid_input',
        message: 'Check the submitted fields.',
        requestId: c.get('requestId'),
        fields:
          e instanceof ZodError ? e.issues.map((i) => i.path.join('.')) : [],
      },
      400,
    );
  console.error(
    JSON.stringify({ requestId: c.get('requestId'), error: 'internal_error' }),
  );
  return c.json(
    {
      error: 'internal_error',
      message: 'The request could not be completed.',
      requestId: c.get('requestId'),
    },
    500,
  );
});
app.get('/healthz', (c) => c.json({ status: 'ok', captureAvailable: false }));
app.get('/api/config', (c) =>
  c.json({
    captureAvailable: false,
    g0: 'blocked',
    authDelivery: !!c.env.MAILER,
    consentVersion: c.env.CONSENT_VERSION,
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null,
  }),
);
app.post('/auth/web/code/send', sendCode);
app.post('/auth/web/code/verify', verifyCode);
app.post('/auth/web/refresh', refresh);
app.post('/auth/web/logout', logout);
app.use('/api/*', async (c, next) => {
  await identify(c);
  await next();
});
app.get('/api/me', async (c) => {
  const actor = c.get('actor');
  const workspaces = await c.env.DB.prepare(
    "SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON w.id=m.workspace_id WHERE m.user_id=? AND m.status='active' AND w.deleted_at IS NULL",
  )
    .bind(actor.id)
    .all();
  return c.json({
    user: { id: actor.id, email: actor.email },
    workspaces: workspaces.results,
  });
});
app.post('/api/workspaces', async (c) => {
  const { name } = z
    .object({ name: z.string().trim().min(2).max(80) })
    .parse(await c.req.json());
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)',
    ).bind(id, name, Date.now()),
    c.env.DB.prepare(
      "INSERT INTO memberships VALUES(?,?,'owner','active')",
    ).bind(id, c.get('actor').id),
  ]);
  return c.json({ id, name }, 201);
});
app.use('/api/workspaces/:w/*', async (c, next) => {
  await new Repository(c.env.DB, c.get('actor'), c.req.param('w')).member();
  await next();
});
app.get('/api/workspaces/:w/meetings', async (c) =>
  c.json(
    await new Repository(c.env.DB, c.get('actor'), c.req.param('w')).meetings(
      c.req.query('q') ?? '',
      c.req.query('status') ?? '',
      c.req.query('visibility') ?? '',
      c.req.query('cursor'),
    ),
  ),
);
app.post('/api/workspaces/:w/meetings', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.member();
  const body = joinSchema.parse(await c.req.json());
  normalizeMeetUrl(body.url);
  if (body.consentVersion !== c.env.CONSENT_VERSION)
    throw new ApiError(
      409,
      'consent_changed',
      'Review the latest recording disclosure.',
    );
  await limited(c.env.DB, `join:${repo.workspace}:${repo.actor.id}`, 10, 60000);
  throw new ApiError(
    503,
    'capture_unavailable',
    'Live capture is disabled until the consented Cloudflare feasibility test passes.',
  );
});
app.get('/api/workspaces/:w/meetings/:m', async (c) =>
  c.json(
    await new Repository(c.env.DB, c.get('actor'), c.req.param('w')).meeting(
      c.req.param('m'),
    ),
  ),
);
app.delete('/api/workspaces/:w/meetings/:m', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  return c.json(
    { deletionId: await repo.tombstone(c.req.param('m')), status: 'pending' },
    202,
  );
});
app.post('/api/workspaces/:w/meetings/:m/stop', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  try {
    await repo.meeting(c.req.param('m'), true);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
    await repo.admin();
  }
  const m = await c.env.DB.prepare(
    'SELECT state FROM meetings WHERE workspace_id=? AND id=? AND deleted_at IS NULL',
  )
    .bind(repo.workspace, c.req.param('m'))
    .first<{ state: string }>();
  if (!m)
    throw new ApiError(404, 'meeting_unavailable', 'Meeting unavailable.');
  const changed = await c.env.DB.prepare(
    "UPDATE meetings SET state='stopping',revision=revision+1 WHERE workspace_id=? AND id=? AND deleted_at IS NULL AND state IN ('queued','starting','joining','waiting_for_admission','recording') RETURNING state",
  )
    .bind(repo.workspace, c.req.param('m'))
    .first<{ state: string }>();
  if (changed) await repo.audit('emergency_stop_requested', c.req.param('m'));
  const current = await c.env.DB.prepare(
    'SELECT state FROM meetings WHERE workspace_id=? AND id=? AND deleted_at IS NULL',
  )
    .bind(repo.workspace, c.req.param('m'))
    .first<{ state: string }>();
  if (!current)
    throw new ApiError(404, 'meeting_unavailable', 'Meeting unavailable.');
  return c.json({ state: current.state, stopConfirmed: false });
});
app.get('/api/workspaces/:w/meetings/:m/transcript', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.meeting(c.req.param('m'));
  const version = await c.env.DB.prepare(
    'SELECT MAX(version) AS version FROM transcripts WHERE workspace_id=? AND meeting_id=?',
  )
    .bind(repo.workspace, c.req.param('m'))
    .first<{ version: number | null }>();
  const rows = version?.version
    ? await c.env.DB.prepare(
        'SELECT id,start_ms,end_ms,speaker,text,version FROM transcript_segments WHERE workspace_id=? AND meeting_id=? AND version=? ORDER BY start_ms,id',
      )
        .bind(repo.workspace, c.req.param('m'), version.version)
        .all()
    : { results: [] };
  return c.json({ version: version?.version ?? null, segments: rows.results });
});
app.get('/api/workspaces/:w/meetings/:m/minutes', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.meeting(c.req.param('m'));
  const row = await c.env.DB.prepare(
    'SELECT version,status,body FROM minutes WHERE workspace_id=? AND meeting_id=? ORDER BY version DESC LIMIT 1',
  )
    .bind(repo.workspace, c.req.param('m'))
    .first<{ version: number; status: string; body: string }>();
  return c.json(
    row
      ? { ...row, body: JSON.parse(row.body) }
      : { status: 'unavailable', body: null },
  );
});
app.get('/api/workspaces/:w/actions', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.member();
  const rows = await c.env.DB.prepare(
    "SELECT a.*,m.title AS meeting_title FROM action_items a JOIN meetings m ON m.workspace_id=a.workspace_id AND m.id=a.meeting_id WHERE m.workspace_id=? AND m.deleted_at IS NULL AND (m.creator_id=? OR m.visibility='workspace' OR EXISTS(SELECT 1 FROM meeting_grants g WHERE g.workspace_id=m.workspace_id AND g.meeting_id=m.id AND g.user_id=?)) ORDER BY a.id LIMIT 100",
  )
    .bind(repo.workspace, repo.actor.id, repo.actor.id)
    .all();
  return c.json({ items: rows.results, nextCursor: null });
});
app.patch('/api/workspaces/:w/meetings/:m/actions/:a', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.meeting(c.req.param('m'), true);
  const body = z
    .object({
      title: z.string().trim().min(1).max(300),
      status: z.enum(['open', 'complete']),
      ownerId: z.string().nullable(),
      dueDate: z.iso.date().nullable(),
      expectedRevision: z.number().int().positive(),
    })
    .parse(await c.req.json());
  if (
    body.ownerId &&
    !(await c.env.DB.prepare(
      "SELECT 1 FROM memberships WHERE workspace_id=? AND user_id=? AND status='active'",
    )
      .bind(repo.workspace, body.ownerId)
      .first())
  )
    throw new ApiError(
      400,
      'invalid_owner',
      'Assign an active workspace member.',
    );
  const row = await c.env.DB.prepare(
    'UPDATE action_items SET title=?,status=?,owner_id=?,due_date=?,revision=revision+1,reviewed_at=? WHERE workspace_id=? AND meeting_id=? AND id=? AND revision=? RETURNING *',
  )
    .bind(
      body.title,
      body.status,
      body.ownerId,
      body.dueDate,
      Date.now(),
      repo.workspace,
      c.req.param('m'),
      c.req.param('a'),
      body.expectedRevision,
    )
    .first();
  if (!row)
    throw new ApiError(
      409,
      'revision_conflict',
      'This action changed. Reload before saving.',
    );
  return c.json(row);
});
app.get('/api/workspaces/:w/members', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.admin();
  return c.json({
    items: (
      await c.env.DB.prepare(
        'SELECT m.user_id,m.role,m.status,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE workspace_id=?',
      )
        .bind(repo.workspace)
        .all()
    ).results,
  });
});
app.get('/api/workspaces/:w/settings', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.member();
  return c.json(
    await c.env.DB.prepare(
      'SELECT name,audio_days,content_days,revision FROM workspaces WHERE id=?',
    )
      .bind(repo.workspace)
      .first(),
  );
});
app.patch('/api/workspaces/:w/settings', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.admin();
  const b = z
    .object({
      name: z.string().trim().min(2).max(80),
      audioDays: z.number().int().min(1).max(30),
      contentDays: z.number().int().min(1).max(90),
      expectedRevision: z.number().int().positive(),
    })
    .parse(await c.req.json());
  const row = await c.env.DB.prepare(
    'UPDATE workspaces SET name=?,audio_days=?,content_days=?,revision=revision+1 WHERE id=? AND revision=? RETURNING revision',
  )
    .bind(
      b.name,
      b.audioDays,
      b.contentDays,
      repo.workspace,
      b.expectedRevision,
    )
    .first();
  if (!row)
    throw new ApiError(
      409,
      'revision_conflict',
      'Settings changed. Reload before saving.',
    );
  return c.json(row);
});
app.get('/api/workspaces/:w/usage', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.member();
  const usage = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(CASE WHEN state='reserved' THEN reserved_seconds ELSE 0 END),0) AS reservedSeconds,COALESCE(SUM(settled_seconds),0) AS capturedSeconds FROM usage_reservations WHERE workspace_id=? AND created_at>?",
  )
    .bind(repo.workspace, Date.now() - 2592000000)
    .first();
  return c.json({
    ...usage,
    maxMinutes: 600,
    maxConcurrent: 2,
    maxSessionMinutes: 120,
    captureAvailable: false,
  });
});
app.post('/api/workspaces/:w/chat', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.member();
  z.object({
    question: z.string().trim().min(1).max(2000),
    meetingIds: z.array(z.string()).max(20),
  }).parse(await c.req.json());
  throw new ApiError(
    503,
    'retrieval_unavailable',
    'Cited chat is unavailable until the Cloudflare AI and Vectorize pipeline is configured and verified.',
  );
});
app.get('/api/workspaces/:w/deletions/:id', async (c) => {
  const repo = new Repository(c.env.DB, c.get('actor'), c.req.param('w'));
  await repo.member();
  const row = await c.env.DB.prepare(
    'SELECT d.id,d.status FROM deletion_jobs d JOIN meetings m ON m.workspace_id=d.workspace_id AND m.id=d.meeting_id WHERE d.workspace_id=? AND d.id=? AND m.creator_id=?',
  )
    .bind(repo.workspace, c.req.param('id'), repo.actor.id)
    .first();
  if (!row) throw new ApiError(404, 'not_found', 'Deletion unavailable.');
  return c.json(row);
});
app.notFound((c) =>
  c.json(
    {
      error: 'not_found',
      message: 'Page not found.',
      requestId: c.get('requestId'),
    },
    404,
  ),
);
export default app;
