function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

const DAY_SECONDS = 24 * 60 * 60;

function epochSeconds(value) {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  return timestamp > 1e12 ? timestamp / 1000 : timestamp;
}

function daysSince(value, nowSeconds) {
  const timestamp = epochSeconds(value);
  if (!timestamp) return 3650;
  return Math.max(0, (nowSeconds - timestamp) / DAY_SECONDS);
}

function dailyJitter(projectId, dayBucket) {
  const text = `${String(projectId || '')}:${dayBucket}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (((hash >>> 0) / 4294967295) - 0.5) * 1.2;
}

function recommendationScore(project, nowSeconds) {
  const downloads = Math.max(0, Number(project?.downloads_count || 0));
  const likes = Math.max(0, Number(project?.likes_count || 0));
  const favorites = Math.max(0, Number(project?.favorites_count || 0));

  // 压缩终身计数，避免“发现推荐”退化成“下载最多”的别名。
  const engagement = Math.log1p(downloads)
    + Math.log1p(likes) * 3
    + Math.log1p(favorites) * 5;

  const createdAge = daysSince(project?.created_at || project?.updated_at, nowSeconds);
  const updatedAge = daysSince(project?.updated_at || project?.created_at, nowSeconds);
  const ageDecay = 0.65 + 0.35 * Math.exp(-createdAge / 120);
  const newWorkBoost = 6 * Math.exp(-createdAge / 14);
  const recentUpdateBoost = 2 * Math.exp(-updatedAge / 10);
  const dayBucket = Math.floor(nowSeconds / DAY_SECONDS);

  return engagement * ageDecay
    + newWorkBoost
    + recentUpdateBoost
    + dailyJitter(project?.id, dayBucket);
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
};

function sorterFor(sort) {
  if (sort !== 'popular') return SORTERS[sort] || SORTERS.latest;
  const nowSeconds = Date.now() / 1000;
  return (a, b) => recommendationScore(b, nowSeconds) - recommendationScore(a, nowSeconds)
    || Number(b?.updated_at || 0) - Number(a?.updated_at || 0)
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function filterAndPageCatalog(items, {
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

  filtered.sort(sorterFor(sort));
  const start = Math.max(0, Number(offset || 0));
  const size = Math.max(1, Number(limit || 24));
  const page = filtered.slice(start, start + size);
  return {
    items: page,
    next_offset: start + size < filtered.length ? start + size : null,
    total: filtered.length,
  };
}
