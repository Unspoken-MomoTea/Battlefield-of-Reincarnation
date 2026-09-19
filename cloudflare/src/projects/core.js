import { HttpError } from '../http.js';
import { sha256Hex } from '../security.js';

export const PROJECT_CATEGORIES = ['worldbook', 'regex', 'preset', 'data', 'mixed'];
export const ARTIFACT_KINDS = ['worldbook', 'regex', 'preset', 'data'];
const CATEGORY_SET = new Set(PROJECT_CATEGORIES);
const ARTIFACT_KIND_SET = new Set(ARTIFACT_KINDS);
const FORMAT_SET = new Set(['json', 'text']);
const MAX_BUNDLE_BYTES = 4_000_000;
const MAX_ARTIFACTS = 32;

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function textField(value, name, { min = 0, max }) {
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_input', `${name} 必须是字符串`);
  const normalized = value.trim();
  if (normalized.length < min) throw new HttpError(400, 'invalid_input', `${name} 不能为空`);
  if (normalized.length > max) throw new HttpError(400, 'invalid_input', `${name} 不能超过 ${max} 个字符`);
  return normalized;
}

export function optionalText(value, name, max) {
  if (value === undefined) return undefined;
  return textField(value, name, { max });
}

export function tagsField(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, 'invalid_tags', 'tags 必须是字符串数组');
  const normalized = [];
  const seen = new Set();
  for (const raw of value) {
    if (typeof raw !== 'string') throw new HttpError(400, 'invalid_tags', 'tag 必须是字符串');
    const tag = raw.normalize('NFKC').trim().toLocaleLowerCase();
    if (!tag) continue;
    if (tag.length > 24) throw new HttpError(400, 'invalid_tags', '单个 tag 不能超过 24 个字符');
    if (seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }
  if (normalized.length > 12) throw new HttpError(400, 'invalid_tags', '最多允许 12 个 tag');
  return normalized;
}

export function parseTags(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter(tag => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export function categoryField(value) {
  if (typeof value !== 'string' || !CATEGORY_SET.has(value)) {
    throw new HttpError(400, 'invalid_category', `作品类型必须是：${PROJECT_CATEGORIES.join(', ')}`);
  }
  return value;
}

export function slugField(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{2,63}$/u.test(value)) {
    throw new HttpError(400, 'invalid_slug', 'slug 仅允许 3-64 位小写字母、数字和连字符');
  }
  return value;
}

export function pageParams(request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim().slice(0, 100);
  const category = (url.searchParams.get('category') || '').trim();
  const tag = (url.searchParams.get('tag') || '').normalize('NFKC').trim().toLocaleLowerCase().slice(0, 24);
  if (category && !CATEGORY_SET.has(category)) throw new HttpError(400, 'invalid_category', '作品类型无效');
  const limit = Math.max(1, Math.min(48, Number.parseInt(url.searchParams.get('limit') || '24', 10) || 24));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  return { query, category, tag, limit, offset };
}

export function adminPageParams(request) {
  const base = pageParams(request);
  const url = new URL(request.url);
  const reviewStatus = (url.searchParams.get('review_status') || '').trim();
  if (reviewStatus && !['draft', 'pending', 'approved', 'rejected'].includes(reviewStatus)) {
    throw new HttpError(400, 'invalid_review_status', '审核状态无效');
  }
  return { ...base, reviewStatus };
}

export function projectPublic(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    tags: parseTags(row.tags),
    category: row.category,
    status: 'published',
    version: Number(row.published_version),
    owner_name: row.owner_name,
    created_at: Number(row.created_at),
    downloads_count: Number(row.downloads_count || 0),
    likes_count: Number(row.likes_count || 0),
    favorites_count: Number(row.favorites_count || 0),
    updated_at: Number(row.updated_at),
  };
}

export function projectOwn(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    tags: parseTags(row.tags),
    category: row.category,
    status: row.status,
    latest_version: Number(row.latest_version),
    published_version: Number(row.published_version || 0),
    created_at: Number(row.created_at),
    downloads_count: Number(row.downloads_count || 0),
    likes_count: Number(row.likes_count || 0),
    favorites_count: Number(row.favorites_count || 0),
    updated_at: Number(row.updated_at),
    review_note: row.review_note || '',
  };
}

export function projectAdmin(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    tags: parseTags(row.tags),
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
    downloads_count: Number(row.downloads_count || 0),
    likes_count: Number(row.likes_count || 0),
    favorites_count: Number(row.favorites_count || 0),
    updated_at: Number(row.updated_at),
  };
}

export async function getOwnedProject(env, projectId, user) {
  const project = await env.DB.prepare(
    `SELECT id, owner_user_id, slug, name, summary, tags, category, status,
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

export function assertAdmin(user) {
  if (!Number(user?.is_admin)) throw new HttpError(403, 'admin_required', '需要管理员权限');
}

export async function writeAdminAudit(env, user, { projectId = null, projectVersion = null, action, note = '' }) {
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

export async function buildManifest(project, version, bundle) {
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
