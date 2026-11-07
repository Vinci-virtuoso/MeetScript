import { env } from 'cloudflare:test';
import { beforeEach, it, expect } from 'vitest';
import { app } from '../src/server/app';
import { hash } from '../src/server/domain';
import type { Env } from '../src/server/env';
import { deleteMeeting } from '../src/server/jobs';
const bindings = env as unknown as Env;
const alice = 'a'.repeat(64),
  bob = 'b'.repeat(64),
  admin = 'c'.repeat(64),
  outsider = 'd'.repeat(64);
async function req(
  path: string,
  access = alice,
  body?: unknown,
  method?: string,
  origin = 'https://test.example',
  custom: Partial<Env> = {},
) {
  return app.request(
    `https://test.example${path}`,
    {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: {
        Authorization: `Bearer ${access}`,
        Origin: origin,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...bindings, ...custom },
  );
}
beforeEach(async () => {
  for (const table of [
    'messages',
    'conversations',
    'minutes',
    'action_items',
    'transcript_segments',
    'transcripts',
    'recording_chunks',
    'capture_sessions',
    'deletion_jobs',
    'outbox',
    'usage_reservations',
    'meeting_grants',
    'meetings',
    'membership_invites',
    'memberships',
    'workspaces',
    'sessions',
    'users',
    'otp_challenges',
    'auth_limits',
    'audit_events',
  ])
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  const now = Date.now();
  for (const [id, email, access] of [
    ['alice', 'alice@test.example', alice],
    ['bob', 'bob@test.example', bob],
    ['admin', 'admin@test.example', admin],
    ['outsider', 'other@test.example', outsider],
  ]) {
    await env.DB.prepare('INSERT INTO users VALUES(?,?,?)')
      .bind(id, email, now)
      .run();
    await env.DB.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,NULL)')
      .bind(
        `session-${id}`,
        id,
        await hash(access),
        await hash(`refresh-${id}`),
        now + 900000,
        now + 2592000000,
      )
      .run();
  }
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces(id,name,created_at) VALUES('w1','First',?),('w2','Second',?)",
    ).bind(now, now),
    env.DB.prepare(
      "INSERT INTO memberships VALUES('w1','alice','owner','active'),('w1','bob','member','active'),('w1','admin','admin','active'),('w2','outsider','owner','active')",
    ),
    env.DB.prepare(
      "INSERT INTO meetings(workspace_id,id,creator_id,meet_code,title,timezone,visibility,state,consent_version,consent_at,duration_seconds,created_at) VALUES('w1','m1','alice','abc-defg-hij','Secret title','Africa/Lagos','private','ready','draft-1',?,1800,?),('w1','m2','alice','abc-defg-hik','Shared title','Africa/Lagos','workspace','ready','draft-1',?,1800,?)",
    ).bind(now, now, now, now),
    env.DB.prepare(
      "INSERT INTO action_items(workspace_id,meeting_id,id,title) VALUES('w1','m1','a1','Private task')",
    ),
  ]);
});
it('requires authentication', async () =>
  expect((await req('/api/me', 'bad')).status).toBe(401));
it('returns only active workspaces', async () => {
  const data = (await (await req('/api/me')).json()) as {
    workspaces: unknown[];
  };
  expect(data.workspaces).toHaveLength(1);
});
it('isolates workspaces without leaking titles', async () => {
  const r = await req('/api/workspaces/w1/meetings', outsider);
  expect(r.status).toBe(404);
  expect(await r.text()).not.toContain('Secret title');
});
it('private meetings do not implicitly grant admin read access', async () =>
  expect((await req('/api/workspaces/w1/meetings/m1', admin)).status).toBe(
    404,
  ));
it('workspace sharing permits read but not editing', async () => {
  expect((await req('/api/workspaces/w1/meetings/m2', bob)).status).toBe(200);
  expect(
    (await req('/api/workspaces/w1/meetings/m2', bob, {}, 'DELETE')).status,
  ).toBe(404);
});
it('filters private meetings from list and search', async () => {
  const r = await req('/api/workspaces/w1/meetings?q=Secret', bob);
  expect(await r.json()).toEqual({ items: [], nextCursor: null });
});
it('does not leak private actions', async () => {
  const r = await req('/api/workspaces/w1/actions', bob);
  expect(await r.json()).toEqual({ items: [], nextCursor: null });
});
it('revoked membership takes effect on the next request', async () => {
  await env.DB.prepare(
    "UPDATE memberships SET status='revoked' WHERE workspace_id='w1' AND user_id='alice'",
  ).run();
  expect((await req('/api/workspaces/w1/meetings/m1')).status).toBe(404);
});
it('session revocation takes effect immediately', async () => {
  await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE user_id='alice'")
    .bind(Date.now())
    .run();
  expect((await req('/api/me')).status).toBe(401);
});
it.each(['https://evil.test', 'null', ''])(
  'rejects foreign or absent mutation Origin: %s',
  async (origin) =>
    expect(
      (
        await req(
          '/api/workspaces',
          alice,
          { name: 'Wrong origin' },
          'POST',
          origin,
        )
      ).status,
    ).toBe(403),
);
it('validates join inputs and fails closed even if deployment flags are switched on', async () => {
  const payload = {
    url: 'https://meet.google.com/abc-defg-hij',
    timezone: 'Africa/Lagos',
    durationMinutes: 30,
    consent: true,
    consentVersion: 'draft-1',
  };
  expect(
    (
      await req(
        '/api/workspaces/w1/meetings',
        alice,
        payload,
        undefined,
        undefined,
        { CAPTURE_ENABLED: 'true', G0_PASSED: 'true' },
      )
    ).status,
  ).toBe(503);
  expect(
    (
      await req('/api/workspaces/w1/meetings', alice, {
        ...payload,
        url: 'https://evil.test/abc-defg-hij',
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await req('/api/workspaces/w1/meetings', alice, {
        ...payload,
        consent: false,
      })
    ).status,
  ).toBe(400);
});
it('requires current recording disclosure', async () =>
  expect(
    (
      await req('/api/workspaces/w1/meetings', alice, {
        url: 'https://meet.google.com/abc-defg-hij',
        timezone: 'UTC',
        durationMinutes: 30,
        consent: true,
        consentVersion: 'old',
      })
    ).status,
  ).toBe(409));
it('serializes action edits with expected revisions', async () => {
  const body = {
    title: 'Reviewed task',
    status: 'complete',
    ownerId: null,
    dueDate: null,
    expectedRevision: 1,
  };
  expect(
    (
      await req(
        '/api/workspaces/w1/meetings/m1/actions/a1',
        alice,
        body,
        'PATCH',
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await req(
        '/api/workspaces/w1/meetings/m1/actions/a1',
        alice,
        body,
        'PATCH',
      )
    ).status,
  ).toBe(409);
});
it('rejects assignment to another tenant', async () =>
  expect(
    (
      await req(
        '/api/workspaces/w1/meetings/m1/actions/a1',
        alice,
        {
          title: 'Task',
          status: 'open',
          ownerId: 'outsider',
          dueDate: null,
          expectedRevision: 1,
        },
        'PATCH',
      )
    ).status,
  ).toBe(400));
it('tombstones before cleanup and keeps cleanup idempotent', async () => {
  const r = await req('/api/workspaces/w1/meetings/m1', alice, {}, 'DELETE');
  expect(r.status).toBe(202);
  expect((await req('/api/workspaces/w1/meetings/m1')).status).toBe(404);
  const { deletionId } = (await r.json()) as { deletionId: string };
  await deleteMeeting(bindings, 'w1', 'm1', deletionId);
  await deleteMeeting(bindings, 'w1', 'm1', deletionId);
  const status = await req(`/api/workspaces/w1/deletions/${deletionId}`);
  expect(((await status.json()) as { status: string }).status).toBe('complete');
  expect(
    await env.DB.prepare(
      "SELECT * FROM action_items WHERE meeting_id='m1'",
    ).first(),
  ).toBeNull();
});
it('cannot delete without a tombstone', async () =>
  expect(deleteMeeting(bindings, 'w1', 'm1', 'none')).rejects.toThrow(
    'tombstone',
  ));
it('limits wrong OTP attempts and consumes valid codes exactly once', async () => {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO otp_challenges(id,email,code_hash,expires_at) VALUES(?,?,?,?)',
  )
    .bind(
      id,
      'new@test.example',
      await hash(`${id}:123456`),
      Date.now() + 600000,
    )
    .run();
  const body = { challengeId: id, code: '123456' };
  const responses = await Promise.all([
    req('/auth/web/code/verify', '', body),
    req('/auth/web/code/verify', '', body),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
  const cookie = responses
    .find((r) => r.status === 200)!
    .headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Strict');
});
it('expires used or exhausted OTP challenges', async () => {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO otp_challenges(id,email,code_hash,expires_at,attempts) VALUES(?,?,?,?,5)',
  )
    .bind(
      id,
      'new@test.example',
      await hash(`${id}:123456`),
      Date.now() + 600000,
    )
    .run();
  expect(
    (
      await req('/auth/web/code/verify', '', {
        challengeId: id,
        code: '123456',
      })
    ).status,
  ).toBe(400);
});
it('rotates refresh tokens and rejects replay', async () => {
  const request = () =>
    app.request(
      'https://test.example/auth/web/refresh',
      {
        method: 'POST',
        headers: {
          Origin: 'https://test.example',
          Cookie: 'ms_refresh=refresh-alice',
        },
      },
      bindings,
    );
  const r = await request();
  expect(r.status).toBe(200);
  expect(r.headers.get('Set-Cookie')).toContain('Secure');
  expect((await request()).status).toBe(401);
  expect((await req('/api/me')).status).toBe(401);
});
it('does not reveal a code when email transport is missing', async () => {
  const r = await req('/auth/web/code/send', '', { email: 'new@test.example' });
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain('accessToken');
});
it('public configuration is honest and contains no credentials', async () => {
  const r = await req('/api/config', '');
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({
    captureAvailable: false,
    authDelivery: false,
  });
});
it('migration foreign keys reject cross-workspace meeting grants', async () => {
  await expect(
    env.DB.prepare(
      "INSERT INTO meeting_grants VALUES('w2','m1','outsider','read')",
    ).run(),
  ).rejects.toThrow();
});

it('admin emergency stop is idempotent and grants no private content access', async () => {
  await env.DB.prepare(
    "UPDATE meetings SET state='recording' WHERE workspace_id='w1' AND id='m1'",
  ).run();
  const first = await req('/api/workspaces/w1/meetings/m1/stop', admin, {});
  expect(await first.json()).toEqual({
    state: 'stopping',
    stopConfirmed: false,
  });
  await req('/api/workspaces/w1/meetings/m1/stop', admin, {});
  expect(
    (
      await env.DB.prepare(
        "SELECT revision FROM meetings WHERE workspace_id='w1' AND id='m1'",
      ).first()
    ).revision,
  ).toBe(2);
  expect(
    (await req('/api/workspaces/w1/meetings/m1/transcript', admin)).status,
  ).toBe(404);
});

it('bounds streamed JSON before parsing even without a content-length header', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(40000));
      controller.enqueue(new Uint8Array(40000));
      controller.close();
    },
  });
  const request = new Request('https://test.example/api/workspaces', {
    method: 'POST',
    headers: {
      Origin: 'https://test.example',
      Authorization: `Bearer ${alice}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  const result = await app.fetch(request, bindings);
  expect(result.status).toBe(413);
});
