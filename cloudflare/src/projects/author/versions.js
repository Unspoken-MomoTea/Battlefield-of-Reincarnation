import { HttpError, json, readJson } from '../../http.js';
import {
  buildManifest, getOwnedProject, nowSeconds, textField, validateBundle,
} from '../core.js';

function hasApprovedRelease(project) {
  return Number(project?.published_version || 0) > 0;
}

const CHARACTER_CONTENT_KINDS = new Set([
  'world_character',
  'opening_character',
  'opening_partner',
  'heretic',
]);

function bundleDataKinds(bundle) {
  const kinds = [];
  for (const artifact of bundle?.artifacts || []) {
    if (artifact?.kind !== 'data') continue;
    const values = Array.isArray(artifact.content) ? artifact.content : [artifact.content];
    for (const value of values) {
      const kind = String(value?.kind || '').trim();
      if (kind) kinds.push(kind);
    }
  }
  return [...new Set(kinds)];
}

function projectContentKind(project, bundle) {
  const kinds = bundleDataKinds(bundle);
  if (project.category === 'character') {
    const characterKinds = kinds.filter(kind => CHARACTER_CONTENT_KINDS.has(kind));
    if (characterKinds.length > 1) {
      throw new HttpError(400, 'mixed_character_kind', '一个角色作品不能同时包含多种角色用途');
    }
    return characterKinds[0] || 'world_character';
  }
  return kinds.includes('store_catalog') ? 'store_catalog' : 'extension';
}

export async function uploadProjectVersion(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能上传');
  if (project.status === 'pending') throw new HttpError(409, 'review_pending', '当前版本正在审核，请等待审核结束');
  const body = await readJson(request);
  const changelog = textField(body?.changelog ?? '', 'changelog', { max: 2000 });
  const bundle = validateBundle(body?.bundle);
  const contentKind = projectContentKind(project, bundle);
  const version = Number(project.latest_version) + 1;
  const manifest = await buildManifest({ ...project, kind: contentKind }, version, bundle);
  const uploadNonce = crypto.randomUUID();
  const baseKey = `projects/${project.id}/versions/${version}-${uploadNonce}`;
  const manifestKey = `${baseKey}/manifest.json`;
  const contentKey = `${baseKey}/bundle.json`;
  const autoPublish = hasApprovedRelease(project);
  if (autoPublish && !project.cover_key) {
    throw new HttpError(409, 'cover_required', '发布新版本前必须先上传封面图片');
  }
  const reviewStatus = autoPublish ? 'approved' : 'draft';

  await env.PROJECTS.put(manifestKey, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await env.PROJECTS.put(contentKey, JSON.stringify(bundle), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });

  const now = nowSeconds();
  try {
    await env.DB.prepare(
      `INSERT INTO project_versions
        (project_id, version, manifest_key, content_key, name, summary, tags, dependencies, project_type, content_kind, cover_key, changelog, review_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      project.id, version, manifestKey, contentKey, project.name, project.summary,
      project.tags || '[]', project.dependencies || '[]', project.category, contentKind, project.cover_key || null,
      changelog, reviewStatus, now,
    ).run();

    if (autoPublish) {
      await env.DB.prepare(
        "UPDATE projects SET latest_version = ?, published_version = ?, status = 'published', updated_at = ? WHERE id = ?",
      ).bind(version, version, now, project.id).run();
    } else {
      await env.DB.prepare("UPDATE projects SET latest_version = ?, status = 'draft', updated_at = ? WHERE id = ?")
        .bind(version, now, project.id).run();
    }
  } catch (error) {
    await Promise.allSettled([env.PROJECTS.delete(manifestKey), env.PROJECTS.delete(contentKey)]);
    throw error;
  }
  return json({ project_id: project.id, version, manifest, auto_published: autoPublish }, 201);
}

export async function submitProjectForReview(env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能提交审核');
  if (Number(project.latest_version) < 1) throw new HttpError(409, 'version_required', '请先上传至少一个版本');
  const version = await env.DB.prepare('SELECT version, review_status FROM project_versions WHERE project_id = ? AND version = ?')
    .bind(project.id, project.latest_version).first();
  if (!version) throw new HttpError(500, 'version_missing', '最新版本记录缺失');

  if (
    hasApprovedRelease(project)
    && Number(project.latest_version) === Number(project.published_version)
    && version.review_status === 'approved'
  ) {
    return json({ ok: true, version: Number(project.latest_version), auto_published: true });
  }

  if (!['draft', 'rejected'].includes(version.review_status)) {
    throw new HttpError(409, 'invalid_review_state', '当前版本不能再次提交审核');
  }
  const now = nowSeconds();
  await env.DB.prepare("UPDATE project_versions SET review_status = 'pending', submitted_at = ? WHERE project_id = ? AND version = ?")
    .bind(now, project.id, project.latest_version).run();
  await env.DB.prepare("UPDATE projects SET status = 'pending', updated_at = ? WHERE id = ?")
    .bind(now, project.id).run();
  return json({ ok: true, version: Number(project.latest_version), auto_published: false });
}
