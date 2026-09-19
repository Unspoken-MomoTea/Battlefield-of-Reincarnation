import { HttpError, json, readJson } from '../../http.js';
import { assertAdmin, nowSeconds, textField, writeAdminAudit } from '../core.js';

export async function reviewProject(request, env, user, projectId) {
  assertAdmin(user);
  const body = await readJson(request);
  const decision = body?.decision;
  if (!['approved', 'rejected'].includes(decision)) throw new HttpError(400, 'invalid_decision', 'decision 必须是 approved 或 rejected');
  const note = textField(body?.note ?? '', 'note', { max: 1000 });
  if (decision === 'rejected' && !note) throw new HttpError(400, 'rejection_note_required', '驳回时必须填写原因');
  const project = await env.DB.prepare('SELECT id, latest_version, published_version, status FROM projects WHERE id = ?').bind(projectId).first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');
  const version = await env.DB.prepare('SELECT version, review_status FROM project_versions WHERE project_id = ? AND version = ?').bind(projectId, project.latest_version).first();
  if (!version || version.review_status !== 'pending') throw new HttpError(409, 'review_not_pending', '当前最新版本不在待审核状态');
  const now = nowSeconds();
  await env.DB.prepare('INSERT INTO review_records (project_id, version, reviewer_user_id, decision, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(projectId, project.latest_version, user.id, decision, note, now).run();
  await env.DB.prepare('UPDATE project_versions SET review_status = ?, reviewed_at = ? WHERE project_id = ? AND version = ?')
    .bind(decision, now, projectId, project.latest_version).run();
  if (decision === 'approved') {
    await env.DB.prepare("UPDATE projects SET published_version = latest_version, status = 'published', updated_at = ? WHERE id = ?").bind(now, projectId).run();
  } else {
    await env.DB.prepare("UPDATE projects SET status = 'rejected', updated_at = ? WHERE id = ?").bind(now, projectId).run();
  }
  await writeAdminAudit(env, user, {
    projectId, projectVersion: Number(project.latest_version),
    action: decision === 'approved' ? 'review_approved' : 'review_rejected', note,
  });
  return json({ ok: true, decision, version: Number(project.latest_version) });
}
