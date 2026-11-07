import { env } from 'cloudflare:test';
import { it, expect } from 'vitest';
it('atomically reserves quota under concurrent calls', async () => {
  const stub = env.WORKSPACE_USAGE.get(
    env.WORKSPACE_USAGE.idFromName(crypto.randomUUID()),
  );
  const result = await Promise.all([
    stub.reserve('a', 7200),
    stub.reserve('b', 7200),
    stub.reserve('c', 7200),
  ]);
  expect(result.filter((r) => !('error' in r))).toHaveLength(2);
  expect(result.filter((r) => 'error' in r)).toHaveLength(1);
});
it('settles only once and releases unused reservation', async () => {
  const stub = env.WORKSPACE_USAGE.get(
    env.WORKSPACE_USAGE.idFromName(crypto.randomUUID()),
  );
  await stub.reserve('a', 7200);
  await stub.reserve('b', 7200);
  await stub.settle('a', 60);
  await stub.settle('a', 60);
  expect(await stub.settle('a', 90)).toHaveProperty('error');
  await expect(stub.reserve('c', 7200)).resolves.toMatchObject({ id: 'c' });
  expect(await stub.reserve('c', 60)).toHaveProperty('error');
});
it('fences delayed runner events after a stop', async () => {
  const stub = env.MEETING_SESSION.get(
    env.MEETING_SESSION.idFromName(crypto.randomUUID()),
  );
  await stub.prepare(Date.now() + 600000);
  await stub.event(1, 'starting');
  const stopped = await stub.stop();
  expect(stopped).toMatchObject({
    epoch: 2,
    state: 'stopping',
    stopRequested: true,
  });
  expect(await stub.event(1, 'joining')).toMatchObject({
    epoch: 2,
    state: 'stopping',
  });
  expect(await stub.stop()).toEqual(stopped);
});
