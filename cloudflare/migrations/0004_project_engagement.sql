ALTER TABLE projects ADD COLUMN downloads_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN favorites_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_likes (
  project_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_favorites (
  project_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_likes_user
  ON project_likes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_favorites_user
  ON project_favorites(user_id, created_at DESC);
