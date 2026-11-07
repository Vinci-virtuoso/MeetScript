import { DurableObject } from 'cloudflare:workers';
import { ApiError, transition } from './domain';
import type { Env } from './env';
type Reservation = {
  id: string;
  seconds: number;
  captured: number | null;
  createdAt: number;
};
export class WorkspaceUsage extends DurableObject<Env> {
  async reserve(id: string, seconds: number) {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 7200)
      throw new ApiError(400, 'invalid_duration', 'Invalid capture duration.');
    const result = await this.ctx.storage.transaction(async (tx) => {
      const all = (await tx.get<Reservation[]>('reservations')) ?? [];
      const existing = all.find((r) => r.id === id);
      if (existing) {
        if (existing.seconds !== seconds)
          return { error: 'Reservation payload changed.' };
        return existing;
      }
      const window = Date.now() - 2592000000;
      const recent = all.filter(
        (r) => r.createdAt > window || r.captured === null,
      );
      const used = recent.reduce((n, r) => n + (r.captured ?? r.seconds), 0);
      if (
        recent.filter((r) => r.captured === null).length >= 2 ||
        used + seconds > 36000
      )
        return { error: 'Workspace recording capacity is exhausted.' };
      const value = { id, seconds, captured: null, createdAt: Date.now() };
      await tx.put('reservations', [...recent, value]);
      return value;
    });
    return result;
  }
  async settle(id: string, captured: number) {
    const result = await this.ctx.storage.transaction(async (tx) => {
      const all = (await tx.get<Reservation[]>('reservations')) ?? [];
      const item = all.find((r) => r.id === id);
      if (!item) return { error: 'Reservation unavailable.' };
      if (
        !Number.isInteger(captured) ||
        captured < 0 ||
        captured > item.seconds
      )
        return { error: 'Invalid captured duration.' };
      if (item.captured !== null) {
        if (item.captured !== captured)
          return { error: 'Already settled with a different duration.' };
        return item;
      }
      item.captured = captured;
      await tx.put('reservations', all);
      return item;
    });
    return result;
  }
}
type Session = {
  epoch: number;
  state: string;
  heartbeatAt: number;
  deadline: number;
  stopRequested: boolean;
};
export class MeetingSession extends DurableObject<Env> {
  async prepare(deadline: number) {
    return this.ctx.storage.transaction(async (tx) => {
      const previous = await tx.get<Session>('session');
      if (previous) return previous;
      const next: Session = {
        epoch: 1,
        state: 'queued',
        heartbeatAt: Date.now(),
        deadline,
        stopRequested: false,
      };
      await tx.put('session', next);
      await tx.setAlarm(Math.min(deadline, Date.now() + 60000));
      return next;
    });
  }
  async event(epoch: number, next: string) {
    return this.ctx.storage.transaction(async (tx) => {
      const session = await tx.get<Session>('session');
      if (!session)
        throw new ApiError(404, 'session_unavailable', 'Session unavailable.');
      if (session.stopRequested || session.epoch !== epoch) return session;
      session.state = transition(session.state, next, epoch, session.epoch);
      session.heartbeatAt = Date.now();
      await tx.put('session', session);
      return session;
    });
  }
  async stop() {
    return this.ctx.storage.transaction(async (tx) => {
      const s = await tx.get<Session>('session');
      if (!s) return null;
      if (!s.stopRequested) {
        s.epoch++;
        s.stopRequested = true;
        s.state = s.state === 'queued' ? 'cancelled' : 'stopping';
        await tx.put('session', s);
      }
      return s;
    });
  }
  async alarm() {
    const session = await this.ctx.storage.get<Session>('session');
    if (!session || session.stopRequested) return;
    if (
      Date.now() >= session.deadline ||
      Date.now() - session.heartbeatAt >= 60000
    ) {
      session.stopRequested = true;
      session.epoch++;
      session.state = 'failed';
      await this.ctx.storage.put('session', session);
      return;
    }
    await this.ctx.storage.setAlarm(
      Math.min(session.deadline, session.heartbeatAt + 60000),
    );
  }
  // No runner is started here: G0 must prove the real Container audio path first.
}
