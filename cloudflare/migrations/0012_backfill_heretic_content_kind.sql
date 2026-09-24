UPDATE project_versions
SET content_kind = 'heretic'
WHERE project_type = 'character'
  AND EXISTS (
    SELECT 1 FROM json_each(project_versions.tags) tag_value
    WHERE tag_value.value = '异端库'
  );
