import { HttpError, json, readJson } from '../http.js';
import {
  adminPageParams,
  assertAdmin,
  nowSeconds,
  projectAdmin,
  textField,
  writeAdminAudit,
} from './core.js';

export async function listAdminProjects(request, env, user) {
  assertAdmin(user);
  const { query, category, limit, offset, reviewStatus } = adminPageParams(request);
  const like = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug,
            v.name, v.summary, v.tags, v.category,
            p.status, p.latest_version, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, p.updated_at,
            owner.display_name AS owner_name, owner.discord_id AS owner_discord_id,
            v.review_status, v.changelog, v.created_at AS version_created_at, v.submitted_at, v.reviewed_at,
            rr.decision AS review_decision, rr.note AS review_note,
            reviewer.display_name AS reviewer_name
       FROM projects p
       JOIN users owner ON owner.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version
       LEFT JOIN review_records rr ON rr.id = (
         SELECT MAX(rr2.id)
           FROM review_records rr2
          WHERE rr2.project_id = p.id AND rr2.version = v.version
       )
       LEFT JOIN users reviewer ON reviewer.id = rr.reviewer_user_id
      WHERE p.latest_version > 0
        AND (? = '' OR v.review_status = ?)
        AND (? = '' OR v.name LIKE ? OR v.summary LIKE ? OR owner.display_name LIKE ?)
        AND (? = '' OR v.category = ?)
      ORDER BY
        CASE v.review_status
          WHEN 'pending' THEN 0
          WHEN 'rejected' THEN 1
          WHEN 'draft' THEN 2
          WHEN 'approved' THEN 3
          ELSE 4
        END,
        COALESCE(v.submitted_at, v.reviewed_at, v.created_at) DESC,
        p.updated_at DESC
      LIMIT ? OFFSET ?`,
  )
    .bind(
      reviewStatus,
      reviewStatus,
      query,
      like,
      like,
      like,
      category,
      category,
      limit + 1,
      offset,
    )
    .all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  return json({
    items: rows.slice(0, limit).map(projectAdmin),
    next_offset: hasMore ? offset + limit : null,
  });
}

export async function listPendingProjects(env, user) {
  assertAdmin(user);
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug,
            v.name, v.summary, v.tags, v.category,
            p.status, p.latest_version, p.published_version,
            p.created_at, p.updated_at, u.display_name AS owner_name, v.changelog, v.submitted_at
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version
      WHERE v.review_status = 'pending'
      ORDER BY v.submitted_at ASC`,
  ).all();
  return json({ items: result.results || [] });
}

export async function getPendingProjectReview(env, user, projectId) {
  assertAdmin(user);
  const row = await env.DB.prepare(
    `SELECT p.id, p.slug,
            v.name, v.summary, v.tags, v.category, v.cover_key,
            p.status, p.latest_version, p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, p.updated_at,
            owner.display_name AS owner_name, owner.discord_id AS owner_discord_id,
            v.version, v.changelog, v.created_at AS version_created_at, v.submitted_at,
            v.reviewed_at, v.manifest_key, v.content_key, v.review_status
       FROM projects p
       JOIN users owner ON owner.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.latest_version
      WHERE p.id = ?`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '作品不存在或尚未上传版本');

  const [manifestObject, bundleObject, versionsResult, reviewsResult, auditResult] = await Promise.all([
    env.PROJECTS.get(row.manifest_key),
    env.PROJECTS.get(row.content_key),
    env.DB.prepare(
      `SELECT version, name, summary, tags, category, cover_key,
              changelog, review_status, created_at, submitted_at, reviewed_at
         FROM project_versions
        WHERE project_id = ?
        ORDER BY version DESC`,
    )
      .bind(projectId)
      .all(),
    env.DB.prepare(
      `SELECT rr.version, rr.decision, rr.note, rr.created_at,
              reviewer.display_name AS reviewer_name
         FROM review_records rr
         JOIN users reviewer ON reviewer.id = rr.reviewer_user_id
        WHERE rr.project_id = ?
        ORDER BY rr.id DESC`,
    )
      .bind(projectId)
      .all(),
    env.DB.prepare(
      `SELECT log.project_version, log.action, log.note, log.created_at,
              actor.display_name AS actor_name
         FROM admin_audit_logs log
         JOIN users actor ON actor.id = log.actor_user_id
        WHERE log.project_id = ?
        ORDER BY log.id DESC
        LIMIT 100`,
    )
      .bind(projectId)
      .all(),
  ]);
  if (!manifestObject) throw new HttpError(500, 'manifest_missing', '作品最新版本的 manifest 缺失');
  if (!bundleObject) throw new HttpError(500, 'bundle_missing', '作品最新版本的 bundle 缺失');

  const [manifestText, bundleText] = await Promise.all([
    new Response(manifestObject.body).text(),
    new Response(bundleObject.body).text(),
  ]);

  return json({
    project: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      tags: (() => { try { return JSON.parse(row.tags || '[]'); } catch { return []; } })(),
      category: row.category,
      cover_key: row.cover_key || null,
      project_status: row.status,
      owner_name: row.owner_name,
      owner_discord_id: row.owner_discord_id,
      latest_version: Number(row.latest_version),
      published_version: Number(row.published_version || 0),
      review_status: row.review_status,
      changelog: row.changelog || '',
      version_created_at: Number(row.version_created_at || 0),
      submitted_at: Number(row.submitted_at || 0),
      reviewed_at: Number(row.reviewed_at || 0),
      created_at: Number(row.created_at),
      downloads_count: Number(row.downloads_count || 0),
      likes_count: Number(row.likes_count || 0),
      favorites_count: Number(row.favorites_count || 0),
      updated_at: Number(row.updated_at),
    },
    manifest: JSON.parse(manifestText),
    bundle: JSON.parse(bundleText),
    versions: (versionsResult.results || []).map(version => ({
      version: Number(version.version),
      name: version.name || '',
      summary: version.summary || '',
      tags: (() => { try { return JSON.parse(version.tags || '[]'); } catch { return []; } })(),
      category: version.category || '',
      cover_key: version.cover_key || null,
      changelog: version.changelog || '',
      review_status: version.review_status,
      created_at: Number(version.created_at || 0),
      submitted_at: Number(version.submitted_at || 0),
      reviewed_at: Number(version.reviewed_at || 0),
    })),
    reviews: (reviewsResult.results || []).map(review => ({
      version: Number(review.version),
      decision: review.decision,
      note: review.note || '',
      reviewer_name: review.reviewer_name || '',
      created_at: Number(review.created_at || 0),
    })),
    admin_audit: (auditResult.results || []).map(log => ({
      project_version: Number(log.project_version || 0),
      action: log.action,
      note: log.note || '',
      actor_name: log.actor_name || '',
      created_at: Number(log.created_at || 0),
    })),
  });
}
export async function reviewProject(request, env, user, projectId) {
  assertAdmin(user);
  const body = await readJson(request);
  const decision = body?.decision;
  if (!['approved', 'rejected'].includes(decision)) {
    throw new HttpError(400, 'invalid_decision', 'decision 必须是 approved 或 rejected');
  }
  const note = textField(body?.note ?? '', 'note', { max: 1000 });
  if (decision === 'rejected' && !note) {
    throw new HttpError(400, 'rejection_note_required', '驳回时必须填写原因');
  }
  const project = await env.DB.prepare(
    `SELECT id, latest_version, published_version, status FROM projects WHERE id = ?`,
  )
    .bind(projectId)
    .first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');
  const version = await env.DB.prepare(
    'SELECT version, review_status FROM project_versions WHERE project_id = ? AND version = ?',
  )
    .bind(projectId, project.latest_version)
    .first();
  if (!version || version.review_status !== 'pending') {
    throw new HttpError(409, 'review_not_pending', '当前最新版本不在待审核状态');
  }
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO review_records (project_id, version, reviewer_user_id, decision, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(projectId, project.latest_version, user.id, decision, note, now)
    .run();
  await env.DB.prepare(
    'UPDATE project_versions SET review_status = ?, reviewed_at = ? WHERE project_id = ? AND version = ?',
  )
    .bind(decision, now, projectId, project.latest_version)
    .run();
  if (decision === 'approved') {
    await env.DB.prepare("UPDATE projects SET published_version = latest_version, status = 'published', updated_at = ? WHERE id = ?")
      .bind(now, projectId)
      .run();
  } else {
    await env.DB.prepare("UPDATE projects SET status = 'rejected', updated_at = ? WHERE id = ?")
      .bind(now, projectId)
      .run();
  }
  await writeAdminAudit(env, user, {
    projectId,
    projectVersion: Number(project.latest_version),
    action: decision === 'approved' ? 'review_approved' : 'review_rejected',
    note,
  });
  return json({ ok: true, decision, version: Number(project.latest_version) });
}


export async function setAdminProjectState(request, env, user, projectId) {
  assertAdmin(user);
  const body = await readJson(request);
  const action = body?.action;
  if (!['archive', 'restore'].includes(action)) {
    throw new HttpError(400, 'invalid_admin_action', 'action 必须是 archive 或 restore');
  }
  const note = textField(body?.note ?? '', 'note', { max: 1000 });
  const project = await env.DB.prepare(
    'SELECT id, status, latest_version, published_version FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');

  const latest = Number(project.latest_version) > 0
    ? await env.DB.prepare(
        'SELECT review_status FROM project_versions WHERE project_id = ? AND version = ?',
      )
        .bind(projectId, project.latest_version)
        .first()
    : null;

  let nextStatus;
  if (action === 'archive') {
    if (project.status === 'archived') throw new HttpError(409, 'already_archived', '作品已经下架');
    nextStatus = 'archived';
  } else {
    if (project.status !== 'archived') throw new HttpError(409, 'not_archived', '作品当前没有下架');
    if (latest?.review_status === 'pending') nextStatus = 'pending';
    else if (latest?.review_status === 'rejected') nextStatus = 'rejected';
    else if (latest?.review_status === 'approved' && Number(project.published_version) > 0) nextStatus = 'published';
    else nextStatus = 'draft';
  }

  const now = nowSeconds();
  await env.DB.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
    .bind(nextStatus, now, projectId)
    .run();
  await writeAdminAudit(env, user, {
    projectId,
    projectVersion: Number(project.latest_version || 0),
    action: action === 'archive' ? 'project_archived' : 'project_restored',
    note,
  });
  return json({ ok: true, status: nextStatus });
}

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
      WHERE (? = '' OR log.project_id = ?)
        AND (? = '' OR log.action = ?)
      ORDER BY log.id DESC
      LIMIT ?`,
  )
    .bind(projectId, projectId, action, action, limit)
    .all();
  return json({
    items: (result.results || []).map(log => ({
      id: Number(log.id),
      project_id: log.project_id,
      project_version: Number(log.project_version || 0),
      action: log.action,
      note: log.note || '',
      actor_name: log.actor_name || '',
      created_at: Number(log.created_at || 0),
    })),
  });
}
