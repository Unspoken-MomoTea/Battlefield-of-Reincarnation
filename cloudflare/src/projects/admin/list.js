import { json } from '../../http.js';
import { adminPageParams, assertAdmin, projectAdmin } from '../core.js';

export async function listAdminProjects(request, env, user) {
  assertAdmin(user);
  const { query, category, limit, offset, reviewStatus } = adminPageParams(request);
  const like = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, v.name, v.summary, v.tags, v.dependencies, v.project_type AS category, v.cover_key,
            p.status, p.owner_hidden, p.latest_version, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count, p.created_at, p.updated_at,
            owner.display_name AS owner_name, owner.discord_id AS owner_discord_id, owner.is_banned AS owner_is_banned,
            v.review_status, v.changelog, v.created_at AS version_created_at, v.submitted_at, v.reviewed_at,
            rr.decision AS review_decision, rr.note AS review_note, reviewer.display_name AS reviewer_name
       FROM projects p
       JOIN users owner ON owner.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version
       LEFT JOIN review_records rr ON rr.id = (
         SELECT MAX(rr2.id) FROM review_records rr2 WHERE rr2.project_id = p.id AND rr2.version = v.version
       )
       LEFT JOIN users reviewer ON reviewer.id = rr.reviewer_user_id
      WHERE p.latest_version > 0
        AND (? = '' OR v.review_status = ?)
        AND (? = '' OR v.name LIKE ? OR v.summary LIKE ? OR owner.display_name LIKE ?)
        AND (? = '' OR v.project_type = ?)
      ORDER BY CASE v.review_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 WHEN 'draft' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END,
        COALESCE(v.submitted_at, v.reviewed_at, v.created_at) DESC, p.updated_at DESC
      LIMIT ? OFFSET ?`,
  ).bind(reviewStatus, reviewStatus, query, like, like, like, category, category, limit + 1, offset).all();
  const rows = result.results || [];
  return json({ items: rows.slice(0, limit).map(projectAdmin), next_offset: rows.length > limit ? offset + limit : null });
}
