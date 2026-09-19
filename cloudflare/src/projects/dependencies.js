import { HttpError } from '../http.js';

export function parseDependencies(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === 'object' && typeof item.project_id === 'string')
      .map(item => ({
        project_id: item.project_id,
        min_version: Math.max(1, Number.parseInt(String(item.min_version || 1), 10) || 1),
      }));
  } catch {
    return [];
  }
}

function normalizeDependencyList(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, 'invalid_dependencies', 'dependencies 必须是数组');
  if (value.length > 12) throw new HttpError(400, 'invalid_dependencies', '最多允许 12 个依赖');

  const byId = new Map();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'invalid_dependencies', '依赖项结构无效');
    }
    const projectId = typeof item.project_id === 'string' ? item.project_id.trim() : '';
    const minVersion = Number(item.min_version ?? 1);
    if (!projectId || projectId.length > 128) {
      throw new HttpError(400, 'invalid_dependencies', '依赖项目 ID 无效');
    }
    if (!Number.isInteger(minVersion) || minVersion < 1 || minVersion > 1_000_000) {
      throw new HttpError(400, 'invalid_dependencies', '依赖最低版本必须是正整数');
    }
    byId.set(projectId, Math.max(minVersion, byId.get(projectId) ?? 0));
  }

  return [...byId.entries()]
    .map(([project_id, min_version]) => ({ project_id, min_version }))
    .sort((a, b) => a.project_id.localeCompare(b.project_id));
}

export async function validateDependencies(env, projectId, value) {
  const normalized = normalizeDependencyList(value);
  if (normalized === undefined) return undefined;
  if (!normalized.length) return [];

  if (normalized.some(item => item.project_id === projectId)) {
    throw new HttpError(400, 'dependency_self_reference', '作品不能依赖自己');
  }

  const ids = normalized.map(item => item.project_id);
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT id, published_version, status
       FROM projects
      WHERE id IN (${placeholders})`,
  ).bind(...ids).all();
  const rows = new Map((result.results || []).map(row => [row.id, row]));

  for (const dependency of normalized) {
    const row = rows.get(dependency.project_id);
    if (
      !row ||
      row.status === 'archived' ||
      Number(row.published_version || 0) < dependency.min_version
    ) {
      throw new HttpError(
        409,
        'dependency_unavailable',
        `依赖作品 ${dependency.project_id} 当前没有可用的 v${dependency.min_version} 或更高版本`,
      );
    }
  }

  return normalized;
}
