-- users: one row per account. Created by loginbase's onVerified hook (src/server/auth/login.ts).
-- id is a text ULID; timestamps are integer milliseconds since the epoch (UTC).
-- plan is a cache of the subscription state: 'free' or 'pro'; pro_until is the ms when Pro ends.
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  pro_until   INTEGER,
  github_id   TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
