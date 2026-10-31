-- splits: a saved split. `code` is the v1 link code (contract C1), so the whole input travels as the
-- same frozen format the share link uses; currency, rent and persons are denormalized for the list.
CREATE TABLE IF NOT EXISTS splits (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  currency    TEXT NOT NULL,
  rent        INTEGER NOT NULL,
  persons     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_splits_owner_id_updated_at ON splits(owner_id, updated_at);
