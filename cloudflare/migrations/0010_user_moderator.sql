ALTER TABLE users ADD COLUMN is_moderator INTEGER NOT NULL DEFAULT 0 CHECK (is_moderator IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_users_moderator
  ON users(is_moderator, updated_at DESC);
