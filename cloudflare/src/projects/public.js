import { recordProjectDownload } from '../engagement.js';
import { HttpError, json } from '../http.js';
import { pageParams, projectPublic } from './core.js';
import { filterPublicCatalog, readPublicCatalog } from './catalog.js';
import { buildPublicContentPreview } from './public-preview.js';

const PUBLIC_KIND_SQL = "COALESCE(NULLIF(v.content_kind, ''), CASE WHEN v.project_type = 'character' AND EXISTS (SELECT 1 FROM json_each(v.tags) legacy_kind WHERE legacy_kind.value = '异端库') THEN 'heretic' WHEN v.project_type = 'character' THEN 'world_character' ELSE 'extension' END)";

export async function listPublicProjects(request, env) {
  const params = pageParams(request);
  const catalog = await readPublicCatalog(env);
  return json(filterPublicCatalog(catalog.items, params), 200, {
    'Cache-Control': 'no-store',
  });
}

export async function getPublicProject(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT p.id, p.slug,
            v.name, v.summary, v.tags, v.dependencies, v.project_type AS category,
            ${PUBLIC_KIND_SQL} AS kind, v.cover_key,
            p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, COALESCE(v.reviewed_at, v.created_at) AS updated_at,
            u.display_name AS owner_name,
            v.changelog, v.manifest_key, v.content_key
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'
        AND p.owner_hidden = 0`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  const [manifestObject, contentObject] = await Promise.all([
    env.PROJECTS.get(row.manifest_key),
    env.PROJECTS.get(row.content_key),
  ]);
  if (!manifestObject) throw new HttpError(500, 'manifest_missing', '作品清单文件缺失');
  if (!contentObject) throw new HttpError(500, 'bundle_missing', '作品包文件缺失');

  const manifest = JSON.parse(await new Response(manifestObject.body).text());
  const bundle = JSON.parse(await new Response(contentObject.body).text());
  const contentPreview = buildPublicContentPreview(bundle);

  return json({
    project: projectPublic(row),
    changelog: row.changelog || '',
    manifest,
    content_preview: contentPreview,
    change_preview: null,
    version_history: [],
  });
}

export async function getPublicProjectVersion(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT p.id, p.published_version, COALESCE(v.reviewed_at, v.created_at) AS updated_at
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'
        AND p.owner_hidden = 0`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  return json({
    id: row.id,
    version: Number(row.published_version),
    status: 'published',
    updated_at: Number(row.updated_at),
  });
}

export async function downloadPublicProject(projectId, env, requestedVersion = null) {
  const hasRequestedVersion = requestedVersion !== null && requestedVersion !== undefined && String(requestedVersion).trim() !== '';
  const version = hasRequestedVersion ? Number(requestedVersion) : null;
  if (hasRequestedVersion && (!Number.isInteger(version) || version < 1)) {
    throw new HttpError(400, 'invalid_project_version', '作品版本号无效');
  }

  const row = hasRequestedVersion
    ? await env.DB.prepare(
      `SELECT v.content_key, v.version
         FROM projects p
         JOIN project_versions v ON v.project_id = p.id
        WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'
          AND p.owner_hidden = 0
          AND v.version = ?
          AND v.version <= p.published_version
          AND v.review_status = 'approved'`,
    ).bind(projectId, version).first()
    : await env.DB.prepare(
      `SELECT v.content_key, v.version
         FROM projects p
         JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
        WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'
          AND p.owner_hidden = 0`,
    ).bind(projectId).first();

  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  const object = await env.PROJECTS.get(row.content_key);
  if (!object) throw new HttpError(500, 'bundle_missing', '作品包文件缺失');
  await recordProjectDownload(env, projectId);
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/json; charset=utf-8',
      'Cache-Control': hasRequestedVersion
        ? 'public, max-age=31536000, immutable'
        : 'no-store',
      'X-Workshop-Project-Version': String(row.version),
    },
  });
}
