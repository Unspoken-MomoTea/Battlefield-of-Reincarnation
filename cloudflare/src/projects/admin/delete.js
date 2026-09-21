import { HttpError, json } from '../../http.js';
import { assertAdmin, writeAdminAudit } from '../core.js';
import { permanentlyDeleteProject } from '../delete.js';

export async function deleteAdminProject(env, user, projectId) {
  assertAdmin(user);

  const project = await env.DB.prepare(
    `SELECT id, name, status, latest_version, published_version, cover_key
       FROM projects
      WHERE id = ?`,
  ).bind(projectId).first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');

  const cleanup = await permanentlyDeleteProject(env, project);

  try {
    await writeAdminAudit(env, user, {
      projectId: null,
      projectVersion: Number(project.latest_version || 0),
      action: 'project_deleted',
      note: `永久删除作品：${project.name}（${project.id}）`,
    });
  } catch {}

  return json({
    ok: true,
    deleted_project_id: project.id,
    deleted_objects: cleanup.deleted_objects,
  });
}