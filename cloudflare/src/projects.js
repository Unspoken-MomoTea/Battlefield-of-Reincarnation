import { HttpError, json, readJson } from './http.js';
import { sha256Hex } from './security.js';

export const PROJECT_CATEGORIES = ['worldbook', 'regex', 'preset', 'data', 'mixed'];
export const ARTIFACT_KINDS = ['worldbook', 'regex', 'preset', 'data'];
const CATEGORY_SET = new Set(PROJECT_CATEGORIES);
const ARTIFACT_KIND_SET = new Set(ARTIFACT_KINDS);
const FORMAT_SET = new Set(['json', 'text']);
const MAX_BUNDLE_BYTES = 4_000_000;
const MAX_ARTIFACTS = 32;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function textField(value, name, { min = 0, max }) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_input', `${name} 必须是字符串`);
  const normalized = value.trim();
  if (normalized.length < min) throw new HttpError(400, 'invalid_input', `${name} 不能为空`);
  if (normalized.length > max) throw new HttpError(400, 'invalid_input', `${name} 不能超过 ${max} 个字符`);
  return normalized;
}

function optionalText(value, name, max) {
  if (value === undefined) return undefined;
  return textField(value, name, { max });
}

function categoryField(value) {
  if (typeof value !== 'string' || !CATEGORY_SET.has(value)) {
    throw new HttpError(400, 'invalid_category', `作品类型必须是：${PROJECT_CATEGORIES.join(', ')}`);
  }
  return value;
}

function slugField(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{2,63}$/u.test(value)) {
    throw new HttpError(400, 'invalid_slug', 'slug 仅允许 3-64 位小写字母、数字和连字符');
  }
  return value;
}

function pageParams(request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim().slice(0, 100);
  const category = (url.searchParams.get('category') || '').trim();
  if (category && !CATEGORY_SET.has(category)) throw new HttpError(400, 'invalid_category', '作品类型无效');
  const limit = Math.max(1, Math.min(48, Number.parseInt(url.searchParams.get('limit') || '24', 10) || 24));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  return { query, category, limit, offset };
}

function adminPageParams(request) {
  const base = pageParams(request);
  const url = new URL(request.url);
  const reviewStatus = (url.searchParams.get('review_status') || '').trim();
  if (reviewStatus && !['draft', 'pending', 'approved', 'rejected'].includes(reviewStatus)) {
    throw new HttpError(400, 'invalid_review_status', '审核状态无效');
  }
  return { ...base, reviewStatus };
}

function projectPublic(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    category: row.category,
    status: 'published',
    version: Number(row.published_version),
    owner_name: row.owner_name,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

function projectOwn(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    category: row.category,
    status: row.status,
    latest_version: Number(row.latest_version),
    published_version: Number(row.published_version || 0),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    review_note: row.review_note || '',
  };
}

function projectAdmin(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    category: row.category,
    project_status: row.status,
    latest_version: Number(row.latest_version),
    published_version: Number(row.published_version || 0),
    owner_name: row.owner_name,
    owner_discord_id: row.owner_discord_id,
    review_status: row.review_status,
    changelog: row.changelog || '',
    version_created_at: Number(row.version_created_at || 0),
    submitted_at: Number(row.submitted_at || 0),
    reviewed_at: Number(row.reviewed_at || 0),
    review_decision: row.review_decision || '',
    review_note: row.review_note || '',
    reviewer_name: row.reviewer_name || '',
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

async function getOwnedProject(env, projectId, user) {
  const project = await env.DB.prepare(
    `SELECT id, owner_user_id, slug, name, summary, category, status,
            latest_version, published_version, cover_key, created_at, updated_at
       FROM projects WHERE id = ?`,
  )
    .bind(projectId)
    .first();
  if (!project) throw new HttpError(404, 'project_not_found', '作品不存在');
  if (Number(project.owner_user_id) !== Number(user.id) && !Number(user.is_admin)) {
    throw new HttpError(403, 'forbidden', '你没有权限修改这个作品');
  }
  return project;
}

function assertAdmin(user) {
  if (!Number(user?.is_admin)) throw new HttpError(403, 'admin_required', '需要管理员权限');
}

async function writeAdminAudit(env, user, { projectId = null, projectVersion = null, action, note = '' }) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_logs
      (actor_user_id, project_id, project_version, action, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(user.id, projectId, projectVersion, action, note, nowSeconds())
    .run();
}

function bundleBytes(bundle) {
  return new TextEncoder().encode(JSON.stringify(bundle)).byteLength;
}

function artifactContentText(artifact) {
  if (artifact.format === 'text') return artifact.content;
  return JSON.stringify(artifact.content);
}


function structuredArtifactContent(artifact, name) {
  if (artifact.format === 'json') return artifact.content;
  try {
    return JSON.parse(artifact.content);
  } catch {
    throw new HttpError(400, 'invalid_artifact_content', `${name} 必须包含有效 JSON`);
  }
}

function validateWorldbookContent(artifact, name) {
  const parsed = structuredArtifactContent(artifact, name);
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed.entries
      : null;
  const values = Array.isArray(entries)
    ? entries
    : entries && typeof entries === 'object' && !Array.isArray(entries)
      ? Object.values(entries)
      : [];
  if (!values.length) throw new HttpError(400, 'invalid_worldbook', `${name} 不包含世界书条目`);
  if (values.length > 500) throw new HttpError(400, 'worldbook_too_large', `${name} 超过 500 个世界书条目`);
  for (const [index, entry] of values.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new HttpError(400, 'invalid_worldbook', `${name} 的第 ${index + 1} 个条目结构无效`);
    }
    const entryName = String(entry.name ?? entry.comment ?? '').trim();
    if (!entryName) throw new HttpError(400, 'invalid_worldbook', `${name} 的第 ${index + 1} 个条目缺少名称`);
  }
}

function regexEntries(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  if (Array.isArray(parsed.regexes)) return parsed.regexes;
  if (Array.isArray(parsed.extensions?.regex_scripts)) return parsed.extensions.regex_scripts;
  if (parsed.find_regex !== undefined || parsed.findRegex !== undefined) return [parsed];
  return [];
}

function validateRegexContent(artifact, name) {
  const values = regexEntries(structuredArtifactContent(artifact, name));
  if (!values.length) throw new HttpError(400, 'invalid_regex', `${name} 不包含可识别的正则`);
  if (values.length > 200) throw new HttpError(400, 'regex_too_large', `${name} 超过 200 条正则`);
  for (const [index, regex] of values.entries()) {
    if (!regex || typeof regex !== 'object' || Array.isArray(regex)) {
      throw new HttpError(400, 'invalid_regex', `${name} 的第 ${index + 1} 条正则结构无效`);
    }
    if (typeof (regex.find_regex ?? regex.findRegex) !== 'string') {
      throw new HttpError(400, 'invalid_regex', `${name} 的第 ${index + 1} 条正则缺少 findRegex`);
    }
  }
}

function validatePresetContent(artifact, name) {
  const parsed = structuredArtifactContent(artifact, name);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'invalid_preset', `${name} 的预设根结构必须是对象`);
  }
}

function validateArtifactShape(artifact, name) {
  if (artifact.kind === 'worldbook') validateWorldbookContent(artifact, name);
  if (artifact.kind === 'regex') validateRegexContent(artifact, name);
  if (artifact.kind === 'preset') validatePresetContent(artifact, name);
}
export function validateBundle(bundle, projectCategory) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new HttpError(400, 'invalid_bundle', 'bundle 必须是对象');
  }
  if (bundle.schema_version !== 1) {
    throw new HttpError(400, 'invalid_bundle_version', '目前只支持 schema_version = 1');
  }
  if (!Array.isArray(bundle.artifacts) || bundle.artifacts.length < 1 || bundle.artifacts.length > MAX_ARTIFACTS) {
    throw new HttpError(400, 'invalid_artifacts', `artifacts 必须包含 1-${MAX_ARTIFACTS} 个项目`);
  }

  const artifacts = bundle.artifacts.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError(400, 'invalid_artifact', `第 ${index + 1} 个 artifact 无效`);
    }
    const kind = String(value.kind || '');
    if (!ARTIFACT_KIND_SET.has(kind)) {
      throw new HttpError(400, 'invalid_artifact_kind', `不支持的 artifact 类型：${kind || '(空)'}`);
    }
    if (projectCategory !== 'mixed' && kind !== projectCategory) {
      throw new HttpError(400, 'artifact_category_mismatch', `作品类型 ${projectCategory} 不能包含 ${kind}`);
    }
    const format = String(value.format || '');
    if (!FORMAT_SET.has(format)) throw new HttpError(400, 'invalid_artifact_format', 'artifact format 仅支持 json/text');
    const name = textField(value.name, 'artifact.name', { min: 1, max: 100 });
    if (format === 'text' && typeof value.content !== 'string') {
      throw new HttpError(400, 'invalid_artifact_content', `${name} 的 text 内容必须是字符串`);
    }
    if (format === 'json' && (value.content === undefined || typeof value.content === 'function')) {
      throw new HttpError(400, 'invalid_artifact_content', `${name} 缺少 JSON 内容`);
    }
    let normalizedContent = value.content;
    if (format === 'json') {
      try {
        normalizedContent = JSON.parse(JSON.stringify(value.content));
      } catch {
        throw new HttpError(400, 'invalid_artifact_content', `${name} 不是可序列化 JSON`);
      }
    }
    const normalizedArtifact = { kind, format, name, content: normalizedContent };
    validateArtifactShape(normalizedArtifact, name);
    return normalizedArtifact;
  });

  const normalized = { schema_version: 1, artifacts };
  if (bundleBytes(normalized) > MAX_BUNDLE_BYTES) {
    throw new HttpError(413, 'bundle_too_large', '作品包超过 4 MB 的第一版限制');
  }
  return normalized;
}

async function buildManifest(project, version, bundle) {
  const artifacts = [];
  let totalBytes = 0;
  for (const artifact of bundle.artifacts) {
    const content = artifactContentText(artifact);
    const byteSize = new TextEncoder().encode(content).byteLength;
    totalBytes += byteSize;
    artifacts.push({
      kind: artifact.kind,
      format: artifact.format,
      name: artifact.name,
      byte_size: byteSize,
      sha256: await sha256Hex(content),
    });
  }
  return {
    schema_version: 1,
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      category: project.category,
      version,
    },
    artifact_count: artifacts.length,
    total_bytes: totalBytes,
    artifacts,
  };
}

export async function listPublicProjects(request, env) {
  const { query, category, limit, offset } = pageParams(request);
  const like = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.category, p.published_version,
            p.created_at, p.updated_at, u.display_name AS owner_name
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
      WHERE p.published_version > 0
        AND p.status <> 'archived'
        AND (? = '' OR p.name LIKE ? OR p.summary LIKE ?)
        AND (? = '' OR p.category = ?)
      ORDER BY p.updated_at DESC
      LIMIT ? OFFSET ?`,
  )
    .bind(query, like, like, category, category, limit + 1, offset)
    .all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  return json({
    items: rows.slice(0, limit).map(projectPublic),
    next_offset: hasMore ? offset + limit : null,
  });
}

export async function getPublicProject(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.category, p.published_version,
            p.created_at, p.updated_at, u.display_name AS owner_name,
            v.changelog, v.manifest_key
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  const manifestObject = await env.PROJECTS.get(row.manifest_key);
  if (!manifestObject) throw new HttpError(500, 'manifest_missing', '作品清单文件缺失');
  const manifest = JSON.parse(await new Response(manifestObject.body).text());
  return json({ project: projectPublic(row), changelog: row.changelog || '', manifest });
}

export async function getPublicProjectVersion(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT id, published_version, updated_at
       FROM projects
      WHERE id = ? AND published_version > 0 AND status <> 'archived'`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  return json({ id: row.id, version: Number(row.published_version), status: 'published', updated_at: Number(row.updated_at) });
}

export async function downloadPublicProject(projectId, env) {
  const row = await env.DB.prepare(
    `SELECT v.content_key
       FROM projects p
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.id = ? AND p.published_version > 0 AND p.status <> 'archived'`,
  )
    .bind(projectId)
    .first();
  if (!row) throw new HttpError(404, 'project_not_found', '已发布作品不存在');
  const object = await env.PROJECTS.get(row.content_key);
  if (!object) throw new HttpError(500, 'bundle_missing', '作品包文件缺失');
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export async function listOwnProjects(env, user) {
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.category, p.status, p.latest_version, p.published_version,
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
  const id = crypto.randomUUID();
  const slug = slugField(body?.slug) || `workshop-${id.split('-')[0]}`;
  const existing = await env.DB.prepare('SELECT id FROM projects WHERE slug = ?').bind(slug).first();
  if (existing) throw new HttpError(409, 'slug_exists', '这个 slug 已被使用');
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO projects
      (id, owner_user_id, slug, name, summary, category, status, latest_version, published_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', 0, 0, ?, ?)`,
  )
    .bind(id, user.id, slug, name, summary, category, now, now)
    .run();
  return json({
    project: { id, slug, name, summary, category, status: 'draft', latest_version: 0, published_version: 0, created_at: now, updated_at: now },
  }, 201);
}

export async function updateProject(request, env, user, projectId) {
  const project = await getOwnedProject(env, projectId, user);
  if (project.status === 'archived') throw new HttpError(409, 'project_archived', '已归档作品不能修改');
  const body = await readJson(request);
  const name = optionalText(body?.name, 'name', 80);
  const summary = optionalText(body?.summary, 'summary', 2000);
  const category = body?.category === undefined ? undefined : categoryField(body.category);
  if (category && category !== project.category && Number(project.published_version) > 0) {
    throw new HttpError(409, 'category_locked', '作品首次发布后不能修改类型');
  }
  if (name === undefined && summary === undefined && category === undefined) {
    throw new HttpError(400, 'empty_patch', '没有可修改的字段');
  }
  const next = {
    name: name ?? project.name,
    summary: summary ?? project.summary,
    category: category ?? project.category,
  };
  const now = nowSeconds();
  await env.DB.prepare('UPDATE projects SET name = ?, summary = ?, category = ?, updated_at = ? WHERE id = ?')
    .bind(next.name, next.summary, next.category, now, projectId)
    .run();
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
        (project_id, version, manifest_key, content_key, changelog, review_status, created_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
    )
      .bind(project.id, version, manifestKey, contentKey, changelog, now)
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

export async function listAdminProjects(request, env, user) {
  assertAdmin(user);
  const { query, category, limit, offset, reviewStatus } = adminPageParams(request);
  const like = `%${query}%`;
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug, p.name, p.summary, p.category, p.status, p.latest_version, p.published_version,
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
        AND (? = '' OR p.name LIKE ? OR p.summary LIKE ? OR owner.display_name LIKE ?)
        AND (? = '' OR p.category = ?)
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
    `SELECT p.id, p.slug, p.name, p.summary, p.category, p.status, p.latest_version, p.published_version,
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
    `SELECT p.id, p.slug, p.name, p.summary, p.category, p.status, p.latest_version, p.published_version,
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
      `SELECT version, changelog, review_status, created_at, submitted_at, reviewed_at
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
      category: row.category,
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
      updated_at: Number(row.updated_at),
    },
    manifest: JSON.parse(manifestText),
    bundle: JSON.parse(bundleText),
    versions: (versionsResult.results || []).map(version => ({
      version: Number(version.version),
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
