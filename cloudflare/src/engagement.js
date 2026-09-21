import { HttpError, json, readJson } from './http.js';

const ENGAGEMENT_KINDS = new Set(['like', 'favorite']);

async function requirePublishedProject(env, projectId) {
  const project = await env.DB.prepare(
    `SELECT id, downloads_count, likes_count, favorites_count
       FROM projects
      WHERE id = ? AND published_version > 0 AND status <> 'archived' AND owner_hidden = 0`,
  )
    .bind(projectId)
    .first();
  if (!project) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  return project;
}

export async function getProjectEngagement(env, user, projectId) {
  const project = await requirePublishedProject(env, projectId);
  const flags = await env.DB.prepare(
    `SELECT
       EXISTS(SELECT 1 FROM project_likes WHERE project_id = ? AND user_id = ?) AS user_liked,
       EXISTS(SELECT 1 FROM project_favorites WHERE project_id = ? AND user_id = ?) AS user_favorited`,
  )
    .bind(projectId, user.id, projectId, user.id)
    .first();

  return {
    likes_count: Number(project.likes_count || 0),
    favorites_count: Number(project.favorites_count || 0),
    downloads_count: Number(project.downloads_count || 0),
    user_liked: Boolean(flags?.user_liked),
    user_favorited: Boolean(flags?.user_favorited),
  };
}

export async function setProjectEngagement(env, user, projectId, kind, enabled) {
  if (!ENGAGEMENT_KINDS.has(kind)) {
    throw new HttpError(400, 'invalid_engagement_kind', '互动类型必须是 like 或 favorite');
  }
  if (typeof enabled !== 'boolean') {
    throw new HttpError(400, 'invalid_engagement_state', 'enabled 必须是布尔值');
  }
  await requirePublishedProject(env, projectId);

  const table = kind === 'like' ? 'project_likes' : 'project_favorites';
  const counter = kind === 'like' ? 'likes_count' : 'favorites_count';
  const now = Math.floor(Date.now() / 1000);

  let changed = 0;
  if (enabled) {
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO ${table} (project_id, user_id, created_at) VALUES (?, ?, ?)`,
    )
      .bind(projectId, user.id, now)
      .run();
    changed = Number(result.meta?.changes || 0);
    if (changed) {
      await env.DB.prepare(`UPDATE projects SET ${counter} = ${counter} + 1 WHERE id = ?`)
        .bind(projectId)
        .run();
    }
  } else {
    const result = await env.DB.prepare(
      `DELETE FROM ${table} WHERE project_id = ? AND user_id = ?`,
    )
      .bind(projectId, user.id)
      .run();
    changed = Number(result.meta?.changes || 0);
    if (changed) {
      await env.DB.prepare(
        `UPDATE projects SET ${counter} = CASE WHEN ${counter} > 0 THEN ${counter} - 1 ELSE 0 END WHERE id = ?`,
      )
        .bind(projectId)
        .run();
    }
  }

  return getProjectEngagement(env, user, projectId);
}

export async function recordProjectDownload(env, projectId) {
  const project = await requirePublishedProject(env, projectId);
  await env.DB.prepare(
    'UPDATE projects SET downloads_count = downloads_count + 1 WHERE id = ?',
  )
    .bind(projectId)
    .run();
  return Number(project.downloads_count || 0) + 1;
}

export async function getProjectEngagementResponse(env, user, projectId) {
  return json(await getProjectEngagement(env, user, projectId));
}

export async function setProjectEngagementFromRequest(request, env, user, projectId) {
  const body = await readJson(request);
  return json(
    await setProjectEngagement(env, user, projectId, body?.kind, body?.enabled),
  );
}
