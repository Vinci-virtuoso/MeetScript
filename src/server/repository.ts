import { ApiError } from './domain';
import type { Actor, Meeting } from './env';
export class Repository {
  constructor(
    public db: D1Database,
    public actor: Actor,
    public workspace: string,
  ) {}
  async member() {
    const row = await this.db
      .prepare(
        "SELECT role FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE workspace_id=? AND user_id=? AND status='active' AND w.deleted_at IS NULL",
      )
      .bind(this.workspace, this.actor.id)
      .first<{ role: string }>();
    if (!row)
      throw new ApiError(
        404,
        'workspace_unavailable',
        'Workspace unavailable.',
      );
    return row;
  }
  async admin() {
    const m = await this.member();
    if (!['owner', 'admin'].includes(m.role))
      throw new ApiError(403, 'forbidden', 'Workspace administrator required.');
    return m;
  }
  async meeting(id: string, edit = false) {
    await this.member();
    const row = await this.db
      .prepare(
        `SELECT m.* FROM meetings m WHERE m.workspace_id=? AND m.id=? AND m.deleted_at IS NULL AND (m.creator_id=? OR ${edit ? '0' : "m.visibility='workspace'"} OR EXISTS(SELECT 1 FROM meeting_grants g WHERE g.workspace_id=m.workspace_id AND g.meeting_id=m.id AND g.user_id=? ${edit ? "AND g.permission='edit'" : ''}))`,
      )
      .bind(this.workspace, id, this.actor.id, this.actor.id)
      .first<Meeting>();
    if (!row)
      throw new ApiError(404, 'meeting_unavailable', 'Meeting unavailable.');
    return row;
  }
  async meetings(
    query: string,
    status: string,
    visibility: string,
    cursor?: string,
  ) {
    await this.member();
    let timestamp = Number.MAX_SAFE_INTEGER,
      id = '\uffff';
    if (cursor) {
      try {
        const c = JSON.parse(atob(cursor));
        if (
          !Array.isArray(c) ||
          !Number.isSafeInteger(c[0]) ||
          typeof c[1] !== 'string'
        )
          throw 0;
        [timestamp, id] = c;
      } catch {
        throw new ApiError(400, 'invalid_cursor', 'Invalid page cursor.');
      }
    }
    const result = await this.db
      .prepare(
        `SELECT m.id,m.title,m.created_at,m.state,m.visibility,m.duration_seconds,m.reason FROM meetings m WHERE m.workspace_id=? AND m.deleted_at IS NULL AND (m.creator_id=? OR m.visibility='workspace' OR EXISTS(SELECT 1 FROM meeting_grants g WHERE g.workspace_id=m.workspace_id AND g.meeting_id=m.id AND g.user_id=?)) AND (?='' OR instr(lower(m.title),lower(?))>0) AND (?='' OR m.state=?) AND (?='' OR m.visibility=?) AND (m.created_at<? OR (m.created_at=? AND m.id<?)) ORDER BY m.created_at DESC,m.id DESC LIMIT 21`,
      )
      .bind(
        this.workspace,
        this.actor.id,
        this.actor.id,
        query,
        query,
        status,
        status,
        visibility,
        visibility,
        timestamp,
        timestamp,
        id,
      )
      .all<Meeting>();
    const items = result.results.slice(0, 20);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        result.results.length > 20 && last
          ? btoa(JSON.stringify([last.created_at, last.id]))
          : null,
    };
  }
  async audit(kind: string, id: string) {
    await this.db
      .prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?)')
      .bind(
        crypto.randomUUID(),
        this.workspace,
        this.actor.id,
        kind,
        id,
        Date.now(),
      )
      .run();
  }
  async tombstone(id: string) {
    await this.meeting(id, true);
    const job = crypto.randomUUID();
    const now = Date.now();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE meetings SET deleted_at=?,state='cancelled',revision=revision+1 WHERE workspace_id=? AND id=? AND deleted_at IS NULL",
        )
        .bind(now, this.workspace, id),
      this.db
        .prepare(
          "UPDATE capture_sessions SET epoch=epoch+1,stopped_at=?,state='cancelled' WHERE workspace_id=? AND meeting_id=?",
        )
        .bind(now, this.workspace, id),
      this.db
        .prepare(
          'INSERT INTO deletion_jobs(id,workspace_id,meeting_id,created_at) VALUES(?,?,?,?)',
        )
        .bind(job, this.workspace, id, now),
      this.db
        .prepare(
          "INSERT INTO outbox(id,workspace_id,meeting_id,kind,payload,available_at) VALUES(?,?,?,'delete','{}',?)",
        )
        .bind(job, this.workspace, id, now),
    ]);
    return job;
  }
}
