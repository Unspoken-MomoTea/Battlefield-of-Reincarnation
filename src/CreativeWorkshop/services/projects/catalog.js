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

  filtered.sort(SORTERS[sort] || SORTERS.latest);
  const start = Math.max(0, Number(offset || 0));
  const size = Math.max(1, Number(limit || 24));
  const page = filtered.slice(start, start + size);
  return {
    items: page,
    next_offset: start + size < filtered.length ? start + size : null,
    total: filtered.length,
  };
}
