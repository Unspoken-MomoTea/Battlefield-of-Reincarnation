export async function cleanupProjectVersions(env, projectId, keepVersions = []) {
  const keep = new Set((keepVersions || []).map(Number).filter(value => Number.isInteger(value) && value > 0));
  const result = await env.DB.prepare(
    'SELECT version, manifest_key, content_key, cover_key FROM project_versions WHERE project_id = ? ORDER BY version',
  ).bind(projectId).all();
  const rows = result.results || [];
  const removed = rows.filter(row => !keep.has(Number(row.version)));
  if (!removed.length) return { removedVersions: 0, deletedObjects: 0 };

  const keys = [];
  for (const row of removed) {
    if (row.manifest_key) keys.push(row.manifest_key);
    if (row.content_key) keys.push(row.content_key);
  }
  const deleteResults = await Promise.allSettled([...new Set(keys)].map(key => env.PROJECTS.delete(key)));
  const failed = deleteResults.filter(item => item.status === 'rejected');
  if (failed.length) throw new Error(`清理历史版本对象失败：${failed.length} 项`);

  for (const row of removed) {
    await env.DB.prepare('DELETE FROM project_versions WHERE project_id = ? AND version = ?')
      .bind(projectId, Number(row.version))
      .run();
  }

  const project = await env.DB.prepare('SELECT cover_key FROM projects WHERE id = ?').bind(projectId).first();
  const candidateCovers = [...new Set(removed.map(row => row.cover_key).filter(Boolean))];
  for (const key of candidateCovers) {
    if (key === project?.cover_key) continue;
    const referenced = await env.DB.prepare('SELECT 1 AS used FROM project_versions WHERE cover_key = ? LIMIT 1').bind(key).first();
    if (!referenced) await env.PROJECTS.delete(key);
  }

  return { removedVersions: removed.length, deletedObjects: keys.length };
}

export async function cleanupAllHistoricalVersions(env) {
  const result = await env.DB.prepare(
    'SELECT id, latest_version, published_version FROM projects',
  ).all();
  let removedVersions = 0;
  let deletedObjects = 0;
  for (const project of result.results || []) {
    const keep = [Number(project.latest_version || 0), Number(project.published_version || 0)];
    const cleaned = await cleanupProjectVersions(env, project.id, keep);
    removedVersions += cleaned.removedVersions;
    deletedObjects += cleaned.deletedObjects;
  }
  return { removedVersions, deletedObjects };
}
