import { HttpError, json } from '../../http.js';
import { assertAdmin, parseTags } from '../core.js';

export async function getPendingProjectReview(env, user, projectId) {
  assertAdmin(user);
  const row = await env.DB.prepare(
    `SELECT p.id, p.slug, v.name, v.summary, v.tags, v.category, v.cover_key,
            p.status, p.latest_version, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count, p.created_at, p.updated_at,
            owner.display_name AS owner_name, owner.discord_id AS owner_discord_id,
            v.version, v.changelog, v.created_at AS version_created_at, v.submitted_at,
            v.reviewed_at, v.manifest_key, v.content_key, v.review_status
       FROM projects p
       JOIN users owner ON owner.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version
      WHERE p.id = ?`,
  ).bind(projectId).first();
  if (!row) throw new HttpError(404, 'project_not_found', '作品不存在或尚未上传版本');

  const [manifestObject, bundleObject, versionsResult, reviewsResult, auditResult] = await Promise.all([
    env.PROJECTS.get(row.manifest_key),
    env.PROJECTS.get(row.content_key),
    env.DB.prepare(`SELECT version, name, summary, tags, category, cover_key, changelog, review_status, created_at, submitted_at, reviewed_at FROM project_versions WHERE project_id = ? ORDER BY version DESC`).bind(projectId).all(),
    env.DB.prepare(`SELECT rr.version, rr.decision, rr.note, rr.created_at, reviewer.display_name AS reviewer_name FROM review_records rr JOIN users reviewer ON reviewer.id = rr.reviewer_user_id WHERE rr.project_id = ? ORDER BY rr.id DESC`).bind(projectId).all(),
    env.DB.prepare(`SELECT log.project_version, log.action, log.note, log.created_at, actor.display_name AS actor_name FROM admin_audit_logs log JOIN users actor ON actor.id = log.actor_user_id WHERE log.project_id = ? ORDER BY log.id DESC LIMIT 100`).bind(projectId).all(),
  ]);
  if (!manifestObject) throw new HttpError(500, 'manifest_missing', '作品最新版本的 manifest 缺失');
  if (!bundleObject) throw new HttpError(500, 'bundle_missing', '作品最新版本的 bundle 缺失');
  const [manifestText, bundleText] = await Promise.all([
    new Response(manifestObject.body).text(), new Response(bundleObject.body).text(),
  ]);

  return json({
    project: {
      id: row.id, slug: row.slug, name: row.name, summary: row.summary, tags: parseTags(row.tags),
      category: row.category, has_cover: Boolean(row.cover_key), project_status: row.status,
      owner_name: row.owner_name, owner_discord_id: row.owner_discord_id,
      latest_version: Number(row.latest_version), published_version: Number(row.published_version || 0),
      review_status: row.review_status, changelog: row.changelog || '',
      version_created_at: Number(row.version_created_at || 0), submitted_at: Number(row.submitted_at || 0),
      reviewed_at: Number(row.reviewed_at || 0), created_at: Number(row.created_at),
      downloads_count: Number(row.downloads_count || 0), likes_count: Number(row.likes_count || 0),
      favorites_count: Number(row.favorites_count || 0), updated_at: Number(row.updated_at),
    },
    manifest: JSON.parse(manifestText), bundle: JSON.parse(bundleText),
    versions: (versionsResult.results || []).map(version => ({
      version: Number(version.version), name: version.name || '', summary: version.summary || '',
      tags: parseTags(version.tags), category: version.category || '', has_cover: Boolean(version.cover_key),
      changelog: version.changelog || '', review_status: version.review_status,
      created_at: Number(version.created_at || 0), submitted_at: Number(version.submitted_at || 0),
      reviewed_at: Number(version.reviewed_at || 0),
    })),
    reviews: (reviewsResult.results || []).map(review => ({
      version: Number(review.version), decision: review.decision, note: review.note || '',
      reviewer_name: review.reviewer_name || '', created_at: Number(review.created_at || 0),
    })),
    admin_audit: (auditResult.results || []).map(log => ({
      project_version: Number(log.project_version || 0), action: log.action, note: log.note || '',
      actor_name: log.actor_name || '', created_at: Number(log.created_at || 0),
    })),
  });
}
