import { recordProjectDownload } from '../engagement.js';
import { HttpError, json } from '../http.js';
import { pageParams, projectPublic } from './core.js';
import { buildPublicChangePreview, buildPublicContentPreview } from './public-preview.js';

const PUBLIC_KIND_SQL = "COALESCE(NULLIF(v.content_kind, ''), CASE WHEN v.project_type = 'character' AND EXISTS (SELECT 1 FROM json_each(v.tags) legacy_kind WHERE legacy_kind.value = '异端库') THEN 'heretic' WHEN v.project_type = 'character' THEN 'world_character' ELSE 'extension' END)";

const PUBLIC_SORT_SQL = {
  latest: 'COALESCE(v.reviewed_at, v.created_at) DESC, p.id ASC',
  popular: '(p.likes_count * 3 + p.favorites_count * 4 + p.downloads_count) DESC, COALESCE(v.reviewed_at, v.created_at) DESC, p.id ASC',
  downloads: 'p.downloads_count DESC, COALESCE(v.reviewed_at, v.created_at) DESC, p.id ASC',
  likes: 'p.likes_count DESC, COALESCE(v.reviewed_at, v.created_at) DESC, p.id ASC',
  favorites: 'p.favorites_count DESC, COALESCE(v.reviewed_at, v.created_at) DESC, p.id ASC',
};

export async function listPublicProjects(request, env) {
  const { query, category, tag, kind, sort, limit, offset } = pageParams(request);
  const like = `%${query}%`;
  const orderBy = PUBLIC_SORT_SQL[sort];
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug,
            v.name, v.summary, v.tags, v.dependencies, v.project_type AS category,
            ${PUBLIC_KIND_SQL} AS kind, v.cover_key,
            p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, COALESCE(v.reviewed_at, v.created_at) AS updated_at,
            u.display_name AS owner_name
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.published_version > 0
        AND p.status <> 'archived'
        AND p.owner_hidden = 0
        AND (? = '' OR v.name LIKE ? OR v.summary LIKE ?)
        AND (? = '' OR v.project_type = ?)
        AND (? = '' OR EXISTS (
          SELECT 1 FROM json_each(v.tags) tag_value WHERE tag_value.value = ?
        ))
        AND (? = '' OR ${PUBLIC_KIND_SQL} = ?)
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
  )
    .bind(query, like, like, category, category, tag, tag, kind, kind, limit + 1, offset)
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
  const [manifestObject, contentObject, historyResult] = await Promise.all([
    env.PROJECTS.get(row.manifest_key),
    env.PROJECTS.get(row.content_key),
    env.DB.prepare(
      `SELECT version, changelog, content_key, created_at, reviewed_at
         FROM project_versions
        WHERE project_id = ?
          AND review_status = 'approved'
          AND version <= ?
        ORDER BY version DESC
        LIMIT 20`,
    )
      .bind(projectId, Number(row.published_version))
      .all(),
  ]);
  if (!manifestObject) throw new HttpError(500, 'manifest_missing', '作品清单文件缺失');
  if (!contentObject) throw new HttpError(500, 'bundle_missing', '作品包文件缺失');

  const manifest = JSON.parse(await new Response(manifestObject.body).text());
  const bundle = JSON.parse(await new Response(contentObject.body).text());
  const contentPreview = buildPublicContentPreview(bundle);
  const historyRows = historyResult.results || [];

  let changePreview = null;
  const previous = historyRows[1] || null;
  if (previous?.content_key) {
    const previousObject = await env.PROJECTS.get(previous.content_key);
    if (previousObject) {
      const previousBundle = JSON.parse(await new Response(previousObject.body).text());
      changePreview = buildPublicChangePreview(
        buildPublicContentPreview(previousBundle),
        contentPreview,
        previous.version,
        row.published_version,
      );
    }
  }

  return json({
    project: projectPublic(row),
    changelog: row.changelog || '',
    manifest,
    content_preview: contentPreview,
    change_preview: changePreview,
    version_history: historyRows.map(item => ({
      version: Number(item.version),
      changelog: item.changelog || '',
      created_at: Number(item.created_at || 0),
      reviewed_at: Number(item.reviewed_at || 0),
    })),
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

export async function downloadPublicProject(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT v.content_key
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'
        AND p.owner_hidden = 0`,
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
