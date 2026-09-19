import { HttpError, json, readJson } from '../../http.js';
import { assertAdmin, nowSeconds, textField, writeAdminAudit } from '../core.js';

export async function setAdminProjectState(request, env, user, projectId) {
  assertAdmin(user);
  const body = await readJson(request);
  const action = body?.action;
  if (!['archive', 'restore'].includes(action)) throw new HttpError(400, 'invalid_admin_action', 'action 必须是 archive 或 restore');
  const note = textField(body?.note ?? '', 'note', { max: 1000 });
  const project = await env.DB.prepare('SELECT id, status, latest_version, published_version FROM projects WHERE id = ?').bind(projectId).first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');
  const latest = Number(project.latest_version) > 0
    ? await env.DB.prepare('SELECT review_status FROM project_versions WHERE project_id = ? AND version = ?').bind(projectId, project.latest_version).first()
    : null;
  let nextStatus;
  if (action === 'archive') {
    if (project.status === 'archived') throw new HttpError(409, 'already_archived', '作品已经下架');
    nextStatus = 'archived';
  } else {
    if (project.status !== 'archived') throw new HttpError(409, 'not_archived', '作品当前没有下架');
    if (latest?.review_status === 'pending') nextStatus = 'pending';
    else if (latest?.review_status === 'rejected') nextStatus = 'rejected';
    else if (latest?.review_status === 'approved' && Number(project.published_version) > 0) nextStatus = 'published';
    else nextStatus = 'draft';
  }
  const now = nowSeconds();
  await env.DB.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').bind(nextStatus, now, projectId).run();
  await writeAdminAudit(env, user, {
    projectId, projectVersion: Number(project.latest_version || 0),
    action: action === 'archive' ? 'project_archived' : 'project_restored', note,
  });
  return json({ ok: true, status: nextStatus });
}
