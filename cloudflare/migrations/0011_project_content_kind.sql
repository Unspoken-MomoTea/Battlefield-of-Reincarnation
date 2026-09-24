ALTER TABLE project_versions
ADD COLUMN content_kind TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_project_versions_content_kind
  ON project_versions(content_kind, project_id, version);
