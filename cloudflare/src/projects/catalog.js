import { json } from '../http.js';
import { R2_HARD_LIMIT_BYTES, assertR2Capacity } from '../storage-policy.js';
import { projectPublic } from './serializers.js';

const CATALOG_KEY = 'system/catalog/public-v1.json';
const CATALOG_MAX_AGE_SECONDS = 300;
const PUBLIC_KIND_SQL = "COALESCE(NULLIF(v.content_kind, ''), CASE WHEN v.project_type = 'character' AND EXISTS (SELECT 1 FROM json_each(v.tags) legacy_kind WHERE legacy_kind.value = '异端库') THEN 'heretic' WHEN v.project_type = 'character' THEN 'world_character' ELSE 'extension' END)";

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function score(project) {
  return Number(project?.likes_count || 0) * 3
    + Number(project?.favorites_count || 0) * 4
    + Number(project?.downloads_count || 0);
}

function compareNumberDesc(field) {
  return (a, b) => Number(b?.[field] || 0) - Number(a?.[field] || 0)
    || Number(b?.updated_at || 0) - Number(a?.updated_at || 0)
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}

const SORTERS = {
  latest: compareNumberDesc('updated_at'),
  downloads: compareNumberDesc('downloads_count'),
  likes: compareNumberDesc('likes_count'),
  favorites: compareNumberDesc('favorites_count'),
  popular: (a, b) => score(b) - score(a)
    || Number(b?.updated_at || 0) - Number(a?.updated_at || 0)
    || String(a?.id || '').localeCompare(String(b?.id || '')),
};

export function filterPublicCatalog(items, {
  query = '',
  category = '',
  kind = '',
  tag = '',
  sort = 'latest',
  offset = 0,
  limit = 24,
} = {}) {
  const q = normalized(query);
  const wantedTag = normalized(tag);
  const filtered = (Array.isArray(items) ? items : []).filter(project => {
    if (category && project?.category !== category) return false;
    if (kind && project?.kind !== kind) return false;
    if (wantedTag) {
      const tags = Array.isArray(project?.tags) ? project.tags : [];
      if (!tags.some(value => normalized(value) === wantedTag)) return false;
    }
    if (q) {
      const haystack = [
        project?.name,
        project?.summary,
        project?.owner_name,
        ...(Array.isArray(project?.tags) ? project.tags : []),
      ].map(normalized).join('\n');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  filtered.sort(SORTERS[sort] || SORTERS.latest);
  const start = Math.max(0, Number(offset || 0));
  const size = Math.max(1, Number(limit || 24));
  return {
    items: filtered.slice(start, start + size),
    next_offset: start + size < filtered.length ? start + size : null,
    total: filtered.length,
  };
}

async function catalogRows(env) {
  const result = await env.DB.prepare(
    `SELECT p.id, p.slug,
            v.name, v.summary, v.tags, v.dependencies, v.project_type AS category,
            ${PUBLIC_KIND_SQL} AS kind, v.cover_key,
            p.published_version,
            p.downloads_count, p.likes_count, p.favorites_count,
            p.created_at, COALESCE(v.reviewed_at, v.created_at) AS updated_at,
            u.display_name AS owner_name
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       JOIN project_versions v ON v.project_id = p.id AND v.version = p.published_version
      WHERE p.published_version > 0
        AND p.status <> 'archived'
        AND p.owner_hidden = 0`,
  ).all();
  return (result.results || []).map(row => {
    const project = projectPublic(row);
    return {
      id: project.id,
      name: project.name,
      summary: project.summary,
      tags: project.tags,
      category: project.category,
      kind: project.kind,
      has_cover: project.has_cover,
      version: project.version,
      owner_name: project.owner_name,
      created_at: project.created_at,
      updated_at: project.updated_at,
      downloads_count: project.downloads_count,
      likes_count: project.likes_count,
      favorites_count: project.favorites_count,
    };
  });
}

export async function rebuildPublicCatalog(env) {
  const payload = {
    generated_at: Math.floor(Date.now() / 1000),
    items: await catalogRows(env),
  };
  const text = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text).byteLength;
  await assertR2Capacity(env, bytes, {
    reclaimKeys: [CATALOG_KEY],
    limitBytes: R2_HARD_LIMIT_BYTES,
  });
  await env.PROJECTS.put(CATALOG_KEY, text, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'public, max-age=300',
    },
  });
  return payload;
}

export async function invalidatePublicCatalog(env) {
  try { await env.PROJECTS.delete(CATALOG_KEY); } catch {}
}

export async function readPublicCatalog(env) {
  let payload = null;
  const object = await env.PROJECTS.get(CATALOG_KEY);
  if (object) {
    try { payload = JSON.parse(await new Response(object.body).text()); } catch {}
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || !Array.isArray(payload.items) || now - Number(payload.generated_at || 0) > CATALOG_MAX_AGE_SECONDS) {
    payload = await rebuildPublicCatalog(env);
  }
  return payload;
}

export async function getPublicCatalog(env) {
  const payload = await readPublicCatalog(env);
  return json(payload, 200, {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  });
}
