import { recordProjectDownload } from '../engagement.js';
import { HttpError, json } from '../http.js';
import { pageParams, projectPublic } from './core.js';

export async function listPublicProjects(request, env) {
  const { query, category, tag, limit, offset } = pageParams(request);
  const like = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.tags, p.category, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, p.updated_at, u.display_name AS owner_name
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
      WHERE p.published_version > 0
        AND p.status <> 'archived'
        AND (? = '' OR p.name LIKE ? OR p.summary LIKE ?)
        AND (? = '' OR p.category = ?)
        AND (? = '' OR EXISTS (
          SELECT 1 FROM json_each(p.tags) tag_value WHERE tag_value.value = ?
        ))
      ORDER BY p.updated_at DESC
      LIMIT ? OFFSET ?`,
  )
    .bind(query, like, like, category, category, tag, tag, limit + 1, offset)
    .all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  return json({
    items: rows.slice(0, limit).map(projectPublic),
    next_offset: hasMore ? offset + limit : null,
  });
}

export async function getPublicProject(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.tags, p.category, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, p.updated_at, u.display_name AS owner_name,
            v.changelog, v.manifest_key
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  const manifestObject = await env.PROJECTS.get(row.manifest_key);
  if (!manifestObject) throw new HttpError(500, 'manifest_missing', '作品清单文件缺失');
  const manifest = JSON.parse(await new Response(manifestObject.body).text());
  return json({ project: projectPublic(row), changelog: row.changelog || '', manifest });
}

export async function getPublicProjectVersion(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT id, published_version, updated_at
       FROM projects
      WHERE id = ? AND published_version > 0 AND status <> 'archived'`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  return json({ id: row.id, version: Number(row.published_version), status: 'published', updated_at: Number(row.updated_at) });
}

export async function downloadPublicProject(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT v.content_key
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  const object = await env.PROJECTS.get(row.content_key);
  if (!object) throw new HttpError(500, 'bundle_missing', '作品包文件缺失');
  await recordProjectDownload(env, projectId);
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
