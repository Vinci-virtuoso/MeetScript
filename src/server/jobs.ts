import type { Env } from './env';
import { ApiError } from './domain';
export { WorkspaceUsage, MeetingSession } from './coordinators';
export async function deleteMeeting(
  env: Env,
  workspace: string,
  meeting: string,
  job: string,
) {
  const tombstone = await env.DB.prepare(
    'SELECT deleted_at FROM meetings WHERE workspace_id=? AND id=?',
  )
    .bind(workspace, meeting)
    .first<{ deleted_at: number | null }>();
  if (!tombstone?.deleted_at)
    throw new ApiError(409, 'not_tombstoned', 'Deletion requires a tombstone.');
  await env.DB.prepare(
    "UPDATE deletion_jobs SET status='pending',attempts=attempts+1 WHERE id=? AND workspace_id=? AND meeting_id=?",
  )
    .bind(job, workspace, meeting)
    .run();
  try {
    const sessions = await env.DB.prepare(
      'SELECT id FROM capture_sessions WHERE workspace_id=? AND meeting_id=?',
    )
      .bind(workspace, meeting)
      .all<{ id: string }>();
    if (sessions.results.length)
      throw new ApiError(
        503,
        'stop_unverified',
        'Capture teardown has not been verified. Preserve cleanup as pending.',
      );
    const chunks = await env.DB.prepare(
      'SELECT r2_key FROM recording_chunks WHERE workspace_id=? AND meeting_id=?',
    )
      .bind(workspace, meeting)
      .all<{ r2_key: string }>();
    for (const chunk of chunks.results)
      await env.RECORDINGS.delete(chunk.r2_key);
    // Current build does not write vectors. Refuse to claim deletion of an integrated index.
    if (env.VECTORS)
      throw new ApiError(
        503,
        'vector_cleanup_unconfigured',
        'Vector cleanup must be implemented before enabling the index.',
      );
    await env.DB.batch([
      ...['messages'].map((table) =>
        env.DB.prepare(
          `DELETE FROM ${table} WHERE workspace_id=? AND conversation_id IN (SELECT id FROM conversations WHERE workspace_id=?)`,
        ).bind(workspace, workspace),
      ),
      ...[
        'minutes',
        'action_items',
        'transcript_segments',
        'transcripts',
        'recording_chunks',
      ].map((table) =>
        env.DB.prepare(
          `DELETE FROM ${table} WHERE workspace_id=? AND meeting_id=?`,
        ).bind(workspace, meeting),
      ),
      env.DB.prepare(
        "UPDATE meetings SET title='Deleted meeting',meet_code='',reason=NULL WHERE workspace_id=? AND id=?",
      ).bind(workspace, meeting),
      env.DB.prepare(
        "UPDATE deletion_jobs SET status='complete' WHERE id=? AND workspace_id=? AND meeting_id=?",
      ).bind(job, workspace, meeting),
      env.DB.prepare('UPDATE outbox SET completed_at=? WHERE id=?').bind(
        Date.now(),
        job,
      ),
    ]);
  } catch (e) {
    await env.DB.prepare(
      "UPDATE deletion_jobs SET status='failed' WHERE id=? AND workspace_id=? AND meeting_id=?",
    )
      .bind(job, workspace, meeting)
      .run();
    throw e;
  }
}
export default {
  async scheduled(_event: ScheduledController, env: Env) {
    const jobs = await env.DB.prepare(
      "SELECT d.* FROM deletion_jobs d JOIN outbox o ON o.id=d.id WHERE d.status!='complete' AND d.attempts<5 AND o.available_at<=? LIMIT 10",
    )
      .bind(Date.now())
      .all<{ id: string; workspace_id: string; meeting_id: string }>();
    for (const job of jobs.results)
      try {
        await deleteMeeting(env, job.workspace_id, job.meeting_id, job.id);
      } catch {
        await env.DB.prepare(
          'UPDATE outbox SET available_at=?,attempts=attempts+1 WHERE id=?',
        )
          .bind(
            Date.now() +
              60000 *
                2 **
                  Math.min(
                    5,
                    (
                      await env.DB.prepare(
                        'SELECT attempts FROM deletion_jobs WHERE id=?',
                      )
                        .bind(job.id)
                        .first<{ attempts: number }>()
                    )?.attempts ?? 1,
                  ),
            job.id,
          )
          .run();
      }
  },
} satisfies ExportedHandler<Env>;
