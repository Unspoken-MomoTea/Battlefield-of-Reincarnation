import { json } from '../../http.js';
import { assertAdmin } from '../core.js';

export async function listAdminProjectUpdates(request, env, user) {
  assertAdmin(user);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);

  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.status, p.owner_hidden, p.latest_version, p.published_version, p.updated_at,
            v.version, v.name, v.summary, v.project_type AS category, v.cover_key, v.changelog,
            v.created_at AS version_created_at,
            owner.display_name AS owner_name, owner.discord_id AS owner_discord_id
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
       JOIN users owner ON owner.id = p.owner_user_id
      WHERE p.published_version > 0
        AND v.review_status = 'approved'
        AND NOT EXISTS (
          SELECT 1
            FROM review_records rr
           WHERE rr.project_id = p.id
             AND rr.version = v.version
             AND rr.decision = 'approved'
        )
      ORDER BY v.created_at DESC, p.updated_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(limit + 1, offset).all();

  const rows = result.results || [];
  return json({
    items: rows.slice(0, limit).map(row => ({
      id: row.id,
      slug: row.slug,
      name: row.name || '',
      summary: row.summary || '',
      category: row.category || '',
      has_cover: Boolean(row.cover_key),
      project_status: row.status,
      owner_hidden: Boolean(Number(row.owner_hidden || 0)),
      latest_version: Number(row.latest_version || 0),
      published_version: Number(row.published_version || 0),
      version: Number(row.version || 0),
      changelog: row.changelog || '',
      owner_name: row.owner_name || '',
      owner_discord_id: row.owner_discord_id || '',
      version_created_at: Number(row.version_created_at || 0),
      updated_at: Number(row.updated_at || 0),
    })),
    next_offset: rows.length > limit ? offset + limit : null,
  });
}
