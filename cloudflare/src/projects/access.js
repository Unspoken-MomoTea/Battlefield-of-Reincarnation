import { HttpError } from '../http.js';
import { nowSeconds } from './fields.js';

export async function getOwnedProject(env, projectId, user) {
  const project = await env.DB.prepare(
    `SELECT id, owner_user_id, slug, name, summary, tags, dependencies, category, status,
            latest_version, published_version, cover_key, created_at, updated_at
       FROM projects WHERE id = ?`,
  ).bind(projectId).first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');
  if (Number(project.owner_user_id) !== Number(user.id) && !Number(user.is_admin)) {
    throw new HttpError(403, 'forbidden', '你没有权限修改这个作品');
  }
  return project;
}

export function assertAdmin(user) {
  if (!Number(user?.is_admin)) throw new HttpError(403, 'admin_required', '需要管理员权限');
}

export async function writeAdminAudit(env, user, { projectId = null, projectVersion = null, action, note = '' }) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_logs
      (actor_user_id, project_id, project_version, action, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(user.id, projectId, projectVersion, action, note, nowSeconds()).run();
}
