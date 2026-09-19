import { HttpError, json, readJson } from '../http.js';
import {
  buildManifest,
  categoryField,
  getOwnedProject,
  nowSeconds,
  optionalText,
  parseTags,
  projectOwn,
  slugField,
  tagsField,
  textField,
  validateBundle,
} from './core.js';

export async function listOwnProjects(env, user) {
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.tags, p.category, p.status, p.latest_version, p.published_version,
            p.created_at, p.updated_at,
            COALESCE((
              SELECT rr.note
                FROM review_records rr
               WHERE rr.project_id = p.id AND rr.version = p.latest_version
               ORDER BY rr.id DESC
               LIMIT 1
            ), '') AS review_note
       FROM projects p
      WHERE p.owner_user_id = ?
      ORDER BY p.updated_at DESC`,
  )
    .bind(user.id)
    .all();
  return json({ items: (result.results || []).map(projectOwn) });
}

export async function createProject(request, env, user) {
  const body = await readJson(request);
  const name = textField(body?.name, 'name', { min: 1, max: 80 });
  const summary = textField(body?.summary ?? '', 'summary', { max: 2000 });
  const category = categoryField(body?.category);
  const tags = tagsField(body?.tags) ?? [];
  const id = crypto.randomUUID();
  const slug = slugField(body?.slug) || `workshop-${id.split('-')[0]}`;
  const existing = await env.DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first();
  if (existing) throw new HttpError(409, 'slug_exists', '这个 slug 已被使用');
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO projects
      (id, owner_user_id, slug, name, summary, tags, category, status, latest_version, published_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0, 0, ?, ?)`,
  )
    .bind(id, user.id, slug, name, summary, JSON.stringify(tags), category, now, now)
    .run();
  return json({
    project: { id, slug, name, summary, tags, category, status: 'draft', latest_version: 0, published_version: 0, created_at: now, updated_at: now },
  }, 201);
}

export async function updateProject(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能修改');
  if (project.status === 'pending') throw new HttpError(409, 'review_pending', '作品正在审核，审核结束前不能修改元数据');
  const body = await readJson(request);
  const name = optionalText(body?.name, 'name', 80);
  const summary = optionalText(body?.summary, 'summary', 2000);
  const category = body?.category === undefined ? undefined : categoryField(body.category);
  const tags = tagsField(body?.tags);
  if (category && category !== project.category && Number(project.published_version) > 0) {
    throw new HttpError(409, 'category_locked', '作品首次发布后不能修改类型');
  }
  if (name === undefined && summary === undefined && category === undefined && tags === undefined) {
    throw new HttpError(400, 'empty_patch', '没有可修改的字段');
  }
  const next = {
    name: name ?? project.name,
    summary: summary ?? project.summary,
    category: category ?? project.category,
    tags: tags ?? parseTags(project.tags),
  };
  const now = nowSeconds();
  await env.DB.prepare('UPDATE projects SET name = ?, summary = ?, tags = ?, category = ?, updated_at = ? WHERE id = ?')
    .bind(next.name, next.summary, JSON.stringify(next.tags), next.category, now, projectId)
    .run();

  if (Number(project.latest_version) > 0) {
    const latest = await env.DB.prepare(
      'SELECT review_status FROM project_versions WHERE project_id = ? AND version = ?',
    )
      .bind(projectId, project.latest_version)
      .first();
    if (latest && ['draft', 'rejected'].includes(latest.review_status)) {
      await env.DB.prepare(
        'UPDATE project_versions SET name = ?, summary = ?, tags = ?, category = ? WHERE project_id = ? AND version = ?',
      )
        .bind(next.name, next.summary, JSON.stringify(next.tags), next.category, projectId, project.latest_version)
        .run();
    }
  }
  return json({ ok: true });
}

export async function uploadProjectVersion(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能上传');
  if (project.status === 'pending') throw new HttpError(409, 'review_pending', '当前版本正在审核，请等待审核结束');
  const body = await readJson(request);
  const changelog = textField(body?.changelog ?? '', 'changelog', { max: 2000 });
  const bundle = validateBundle(body?.bundle, project.category);
  const version = Number(project.latest_version) + 1;
  const manifest = await buildManifest(project, version, bundle);
  // 同一作品允许两个上传请求同时到达。R2 key 加入 nonce，避免失败请求清理时
  // 误删另一个已经成功写入同版本号的对象。
  const uploadNonce = crypto.randomUUID();
  const baseKey = `projects/${project.id}/versions/${version}-${uploadNonce}`;
  const manifestKey = `${baseKey}/manifest.json`;
  const contentKey = `${baseKey}/bundle.json`;
  const manifestJson = JSON.stringify(manifest);
  const bundleJson = JSON.stringify(bundle);

  await env.PROJECTS.put(manifestKey, manifestJson, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.PROJECTS.put(contentKey, bundleJson, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });

  const now = nowSeconds();
  try {
    await env.DB.prepare(
      `INSERT INTO project_versions
        (project_id, version, manifest_key, content_key, name, summary, tags, category, cover_key, changelog, review_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    )
      .bind(
        project.id,
        version,
        manifestKey,
        contentKey,
        project.name,
        project.summary,
        project.tags || '[]',
        project.category,
        project.cover_key || null,
        changelog,
        now,
      )
      .run();
    await env.DB.prepare("UPDATE projects SET latest_version = ?, status = 'draft', updated_at = ? WHERE id = ?")
      .bind(version, now, project.id)
      .run();
  } catch (error) {
    await Promise.allSettled([env.PROJECTS.delete(manifestKey), env.PROJECTS.delete(contentKey)]);
    throw error;
  }
  return json({ project_id: project.id, version, manifest }, 201);
}

export async function submitProjectForReview(env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能提交审核');
  if (Number(project.latest_version) < 1) throw new HttpError(409, 'version_required', '请先上传至少一个版本');
  const version = await env.DB.prepare(
    'SELECT version, review_status FROM project_versions WHERE project_id = ? AND version = ?',
  )
    .bind(project.id, project.latest_version)
    .first();
  if (!version) throw new HttpError(500, 'version_missing', '最新版本记录缺失');
  if (!['draft', 'rejected'].includes(version.review_status)) {
    throw new HttpError(409, 'invalid_review_state', '当前版本不能再次提交审核');
  }
  const now = nowSeconds();
  await env.DB.prepare(
    "UPDATE project_versions SET review_status = 'pending', submitted_at = ? WHERE project_id = ? AND version = ?",
  )
    .bind(now, project.id, project.latest_version)
    .run();
  await env.DB.prepare("UPDATE projects SET status = 'pending', updated_at = ? WHERE id = ?")
    .bind(now, project.id)
    .run();
  return json({ ok: true, version: Number(project.latest_version) });
}
