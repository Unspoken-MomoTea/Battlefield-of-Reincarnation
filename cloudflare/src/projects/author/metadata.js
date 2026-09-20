import { HttpError, json, readJson } from '../../http.js';
import {
  getOwnedProject, nowSeconds, optionalText, parseDependencies, parseTags, projectTypeField,
  slugField, tagsField, textField, validateDependencies,
} from '../core.js';

export async function createProject(request, env, user) {
  const body = await readJson(request);
  const name = textField(body?.name, 'name', { min: 1, max: 80 });
  const summary = textField(body?.summary ?? '', 'summary', { max: 2000 });
  const category = projectTypeField(body?.category);
  const tags = tagsField(body?.tags) ?? [];
  const id = crypto.randomUUID();
  const dependencies = await validateDependencies(env, id, body?.dependencies ?? []);
  const slug = slugField(body?.slug) || `workshop-${id.split('-')[0]}`;
  if (await env.DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first()) {
    throw new HttpError(409, 'slug_exists', '这个 slug 已被使用');
  }
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO projects
      (id, owner_user_id, slug, name, summary, tags, dependencies, project_type, status, latest_version, published_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, 0, ?, ?)`,
  ).bind(id, user.id, slug, name, summary, JSON.stringify(tags), JSON.stringify(dependencies), category, now, now).run();
  return json({ project: { id, slug, name, summary, tags, dependencies, category, status: 'draft', latest_version: 0, published_version: 0, created_at: now, updated_at: now } }, 201);
}

export async function updateProject(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能修改');
  if (project.status === 'pending') throw new HttpError(409, 'review_pending', '作品正在审核，审核结束前不能修改元数据');
  const body = await readJson(request);
  const name = optionalText(body?.name, 'name', 80);
  const summary = optionalText(body?.summary, 'summary', 2000);
  const category = body?.category === undefined ? undefined : projectTypeField(body.category);
  const tags = tagsField(body?.tags);
  const dependencies = body?.dependencies === undefined
    ? undefined
    : await validateDependencies(env, projectId, body.dependencies);
  if (category && category !== project.category && Number(project.published_version) > 0) {
    throw new HttpError(409, 'category_locked', '作品首次发布后不能修改类型');
  }
  if (name === undefined && summary === undefined && category === undefined && tags === undefined && dependencies === undefined) {
    throw new HttpError(400, 'empty_patch', '没有可修改的字段');
  }
  const next = {
    name: name ?? project.name, summary: summary ?? project.summary,
    category: category ?? project.category,
    tags: tags ?? parseTags(project.tags),
    dependencies: dependencies ?? parseDependencies(project.dependencies),
  };
  const now = nowSeconds();
  await env.DB.prepare('UPDATE projects SET name = ?, summary = ?, tags = ?, dependencies = ?, project_type = ?, updated_at = ? WHERE id = ?')
    .bind(next.name, next.summary, JSON.stringify(next.tags), JSON.stringify(next.dependencies), next.category, now, projectId).run();

  if (Number(project.latest_version) > 0) {
    const latest = await env.DB.prepare('SELECT review_status FROM project_versions WHERE project_id = ? AND version = ?')
      .bind(projectId, project.latest_version).first();
    if (latest && ['draft', 'rejected'].includes(latest.review_status)) {
      await env.DB.prepare('UPDATE project_versions SET name = ?, summary = ?, tags = ?, dependencies = ?, project_type = ? WHERE project_id = ? AND version = ?')
        .bind(next.name, next.summary, JSON.stringify(next.tags), JSON.stringify(next.dependencies), next.category, projectId, project.latest_version).run();
    }
  }
  return json({ ok: true });
}
