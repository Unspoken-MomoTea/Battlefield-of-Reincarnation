import { HttpError } from '../http.js';
import { PROJECT_TYPES } from './constants.js';

const PROJECT_TYPE_SET = new Set(PROJECT_TYPES);

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

export function projectTypeField(value) {
  if (typeof value !== 'string' || !PROJECT_TYPE_SET.has(value)) {
    throw new HttpError(400, 'invalid_project_type', `作品类型必须是：${PROJECT_TYPES.join(', ')}`);
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
  if (category && !PROJECT_TYPE_SET.has(category)) throw new HttpError(400, 'invalid_project_type', '作品类型无效');
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
