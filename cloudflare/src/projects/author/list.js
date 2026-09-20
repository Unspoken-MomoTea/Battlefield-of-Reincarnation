import { json } from '../../http.js';
import { projectOwn } from '../core.js';

export async function listOwnProjects(env, user) {
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.tags, p.dependencies, p.project_type AS category, p.cover_key,
            p.status, p.latest_version, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, p.updated_at,
            COALESCE((
              SELECT rr.note FROM review_records rr
               WHERE rr.project_id = p.id AND rr.version = p.latest_version
               ORDER BY rr.id DESC LIMIT 1
            ), '') AS review_note
       FROM projects p
      WHERE p.owner_user_id = ?
      ORDER BY p.updated_at DESC`,
  ).bind(user.id).all();
  return json({ items: (result.results || []).map(projectOwn) });
}
