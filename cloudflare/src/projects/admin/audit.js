import { json } from '../../http.js';
import { assertAdmin } from '../core.js';

export async function listAdminAuditLogs(request, env, user) {
  assertAdmin(user);
  const url = new URL(request.url);
  const projectId = (url.searchParams.get('project_id') || '').trim();
  const action = (url.searchParams.get('action') || '').trim();
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const result = await env.DB.prepare(
    `SELECT log.id, log.project_id, log.project_version, log.action, log.note, log.created_at,
            actor.display_name AS actor_name
       FROM admin_audit_logs log
       JOIN users actor ON actor.id = log.actor_user_id
      WHERE (? = '' OR log.project_id = ?) AND (? = '' OR log.action = ?)
      ORDER BY log.id DESC LIMIT ?`,
  ).bind(projectId, projectId, action, action, limit).all();
  return json({ items: (result.results || []).map(log => ({
    id: Number(log.id), project_id: log.project_id, project_version: Number(log.project_version || 0),
    action: log.action, note: log.note || '', actor_name: log.actor_name || '', created_at: Number(log.created_at || 0),
  })) });
}
