export interface Env {
  DB: D1Database;
  RECORDINGS: R2Bucket;
  APP_ORIGIN: string;
  ENVIRONMENT: string;
  CAPTURE_ENABLED: string;
  G0_PASSED: string;
  CONSENT_VERSION: string;
  MAILER?: Fetcher;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  MEETING_SESSION?: DurableObjectNamespace;
  WORKSPACE_USAGE?: DurableObjectNamespace;
  AI?: Ai;
  VECTORS?: VectorizeIndex;
  INGEST_QUEUE?: Queue;
}
export interface Actor {
  id: string;
  sessionId: string;
  email: string;
}
export interface Meeting {
  workspace_id: string;
  id: string;
  creator_id: string;
  title: string;
  visibility: 'private' | 'workspace';
  state: string;
  reason: string | null;
  revision: number;
  deleted_at: number | null;
  created_at: number;
  duration_seconds: number;
}
