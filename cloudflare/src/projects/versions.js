import { HttpError, json, readJson } from '../http.js';

export async function getPublicProjectVersionsBatch(request, env) {
  const body = await readJson(request);
  if (!Array.isArray(body?.ids) || body.ids.length < 1 || body.ids.length > 100) {
    throw new HttpError(400, 'invalid_project_ids', 'ids 必须包含 1-100 个项目 ID');
  }
  const ids = [...new Set(body.ids.map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean))];
  if (!ids.length || ids.some(id => id.length > 128)) {
    throw new HttpError(400, 'invalid_project_ids', '项目 ID 无效');
  }

  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT p.id, p.published_version, COALESCE(v.reviewed_at, v.created_at) AS updated_at
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id IN (${placeholders})
        AND p.published_version > 0
        AND p.status <> 'archived'`,
  ).bind(...ids).all();

  const items = (result.results || []).map(row => ({
    id: row.id,
    version: Number(row.published_version),
    updated_at: Number(row.updated_at || 0),
  }));
  const found = new Set(items.map(item => item.id));
  return json({ items, unavailable: ids.filter(id => !found.has(id)) });
}
