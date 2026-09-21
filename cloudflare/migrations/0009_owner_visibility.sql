ALTER TABLE projects
  ADD COLUMN owner_hidden INTEGER NOT NULL DEFAULT 0
  CHECK (owner_hidden IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_projects_owner_visibility
  ON projects(owner_hidden, published_version, status, updated_at DESC);
