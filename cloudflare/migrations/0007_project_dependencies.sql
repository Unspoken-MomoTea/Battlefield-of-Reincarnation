ALTER TABLE projects ADD COLUMN dependencies TEXT NOT NULL DEFAULT '[]';
ALTER TABLE project_versions ADD COLUMN dependencies TEXT NOT NULL DEFAULT '[]';
