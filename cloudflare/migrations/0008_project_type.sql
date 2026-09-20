ALTER TABLE projects
ADD COLUMN project_type TEXT NOT NULL DEFAULT 'extension'
CHECK (project_type IN ('character', 'extension'));

ALTER TABLE project_versions
ADD COLUMN project_type TEXT NOT NULL DEFAULT 'extension'
CHECK (project_type IN ('character', 'extension'));

CREATE INDEX IF NOT EXISTS idx_projects_type_public
  ON projects(project_type, published_version, status, updated_at DESC);
