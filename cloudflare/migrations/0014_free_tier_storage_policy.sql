ALTER TABLE project_versions ADD COLUMN local_backup_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (local_backup_confirmed IN (0, 1));
