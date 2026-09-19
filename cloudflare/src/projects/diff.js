import { HttpError } from '../http.js';
import { assertAdmin, parseDependencies, parseTags } from './core.js';

function artifactKey(artifact) {
  return `${artifact.kind}:${artifact.name}`;
}

async function readManifest(env, key) {
  if (!key) return null;
  const object = await env.PROJECTS.get(key);
  if (!object) throw new HttpError(500, 'manifest_missing', '作品 manifest 缺失');
  return JSON.parse(await new Response(object.body).text());
}

function artifactSummary(artifact) {
  return {
    kind: artifact.kind,
    name: artifact.name,
    format: artifact.format,
    byte_size: Number(artifact.byte_size || 0),
    sha256: artifact.sha256 || '',
  };
}

function compareArtifacts(baseManifest, targetManifest) {
  const base = new Map((baseManifest?.artifacts || []).map(item => [artifactKey(item), item]));
  const target = new Map((targetManifest?.artifacts || []).map(item => [artifactKey(item), item]));
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const [key, artifact] of target) {
    const before = base.get(key);
    if (!before) {
      added.push(artifactSummary(artifact));
      continue;
    }
    const afterSummary = artifactSummary(artifact);
    const beforeSummary = artifactSummary(before);
    if (
      beforeSummary.sha256 !== afterSummary.sha256 ||
      beforeSummary.byte_size !== afterSummary.byte_size ||
      beforeSummary.format !== afterSummary.format
    ) {
      changed.push({
        kind: artifact.kind,
        name: artifact.name,
        before: beforeSummary,
        after: afterSummary,
      });
    } else {
      unchanged.push(afterSummary);
    }
  }

  for (const [key, artifact] of base) {
    if (!target.has(key)) removed.push(artifactSummary(artifact));
  }

  return { added, removed, changed, unchanged };
}

function changedValue(before, after) {
  return JSON.stringify(before) === JSON.stringify(after) ? null : { before, after };
}

function metadataDiff(base, target) {
  const diff = {
    name: changedValue(base?.name ?? null, target.name),
    summary: changedValue(base?.summary ?? null, target.summary),
    tags: changedValue(base ? parseTags(base.tags) : [], parseTags(target.tags)),
    dependencies: changedValue(
      base ? parseDependencies(base.dependencies) : [],
      parseDependencies(target.dependencies),
    ),
    category: changedValue(base?.category ?? null, target.category),
    cover: changedValue(Boolean(base?.cover_key), Boolean(target.cover_key)),
  };
  return Object.fromEntries(Object.entries(diff).filter(([, value]) => value !== null));
}

export async function getAdminProjectDiff(env, user, projectId) {
  assertAdmin(user);
  const project = await env.DB.prepare(
    'SELECT id, latest_version, published_version FROM projects WHERE id = ?',
  )
    .bind(projectId)
    .first();
  if (!project || Number(project.latest_version) < 1) {
    throw new HttpError(404, 'project_not_found', '作品不存在或尚未上传版本');
  }

  const target = await env.DB.prepare(
    `SELECT version, name, summary, tags, dependencies, category, cover_key, manifest_key, review_status
       FROM project_versions
      WHERE project_id = ? AND version = ?`,
  )
    .bind(projectId, project.latest_version)
    .first();
  if (!target) throw new HttpError(500, 'version_missing', '最新版本记录缺失');

  let base = null;
  if (Number(project.published_version) > 0) {
    base = await env.DB.prepare(
      `SELECT version, name, summary, tags, dependencies, category, cover_key, manifest_key, review_status
         FROM project_versions
        WHERE project_id = ? AND version = ?`,
    )
      .bind(projectId, project.published_version)
      .first();
  }

  const [baseManifest, targetManifest] = await Promise.all([
    base ? readManifest(env, base.manifest_key) : null,
    readManifest(env, target.manifest_key),
  ]);

  return {
    project_id: projectId,
    base_version: base ? Number(base.version) : 0,
    target_version: Number(target.version),
    target_review_status: target.review_status,
    metadata: metadataDiff(base, target),
    artifacts: compareArtifacts(baseManifest, targetManifest),
  };
}
