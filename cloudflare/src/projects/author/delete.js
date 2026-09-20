import { HttpError, json } from '../../http.js';
import { getOwnedProject } from '../core.js';

export async function deleteProject(env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'pending') {
    throw new HttpError(409, 'review_pending', '作品正在审核，不能删除');
  }
  if (Number(project.published_version) > 0) {
    throw new HttpError(409, 'published_project_delete_forbidden', '已发布作品不能直接删除，请先由管理员下架');
  }

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

  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(project.id).run();

  await Promise.allSettled(
    [...objectKeys].map(key => env.PROJECTS.delete(key)),
  );

  return json({ ok: true });
}
