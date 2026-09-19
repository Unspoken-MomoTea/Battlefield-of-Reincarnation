ALTER TABLE project_versions ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE project_versions ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE project_versions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE project_versions ADD COLUMN category TEXT NOT NULL DEFAULT 'data';
ALTER TABLE project_versions ADD COLUMN cover_key TEXT;

UPDATE project_versions
   SET name = COALESCE((SELECT p.name FROM projects p WHERE p.id = project_versions.project_id), name),
       summary = COALESCE((SELECT p.summary FROM projects p WHERE p.id = project_versions.project_id), summary),
       tags = COALESCE((SELECT p.tags FROM projects p WHERE p.id = project_versions.project_id), tags),
       category = COALESCE((SELECT p.category FROM projects p WHERE p.id = project_versions.project_id), category),
       cover_key = COALESCE((SELECT p.cover_key FROM projects p WHERE p.id = project_versions.project_id), cover_key);
