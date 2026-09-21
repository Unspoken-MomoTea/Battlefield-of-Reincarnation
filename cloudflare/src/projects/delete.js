import { HttpError } from '../http.js';

export async function collectProjectObjectKeys(env, project) {
  const versions = await env.DB.prepare(
    'SELECT manifest_key, content_key, cover_key FROM project_versions WHERE project_id = ?',
  ).bind(project.id).all();

  const objectKeys = new Set();
  if (project.cover_key) objectKeys.add(project.cover_key);
  for (const version of versions.results || []) {
    if (version.manifest_key) objectKeys.add(version.manifest_key);
    if (version.content_key) objectKeys.add(version.content_key);
    if (version.cover_key) objectKeys.add(version.cover_key);
  }
  return [...objectKeys];
}

export async function permanentlyDeleteProject(env, project) {
  const objectKeys = await collectProjectObjectKeys(env, project);

  const results = await Promise.allSettled(
    objectKeys.map(key => env.PROJECTS.delete(key)),
  );
  const failedKeys = results
    .map((result, index) => result.status === 'rejected' ? objectKeys[index] : null)
    .filter(Boolean);

  if (failedKeys.length) {
    throw new HttpError(
      502,
      'storage_cleanup_failed',
      `对象存储清理失败，已保留数据库记录，可稍后重试（失败 ${failedKeys.length} 项）`,
    );
  }

  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(project.id).run();

  return {
    deleted_objects: objectKeys.length,
  };
}
