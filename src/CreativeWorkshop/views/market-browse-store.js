function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalized(value) {
  return String(value || '').trim();
}

function normalizedQuality(value) {
  return normalized(value).toUpperCase();
}

function itemPrice(item) {
  return Math.max(0, number(item?.lowest_price, 0));
}

function itemLatest(item) {
  return Math.max(0, number(item?.latest_at, 0));
}

function compareName(left, right) {
  return String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN');
}

function filterItems(items, filters = {}) {
  const kind = normalized(filters.kind);
  const quality = normalizedQuality(filters.quality);
  const subtype = normalized(filters.subtype);
  const query = normalized(filters.query).toLocaleLowerCase('zh-CN');
  const minPrice = Math.max(0, number(filters.minPrice, 0));
  const maxPrice = Math.max(0, number(filters.maxPrice, 0));
  const sort = normalized(filters.sort) || 'price_asc';

  const filtered = items.filter(item => {
    if (kind && item?.kind !== kind) return false;
    if (quality && normalizedQuality(item?.quality) !== quality) return false;
    if (subtype && normalized(item?.subtype) !== subtype) return false;
    if (query && !normalized(item?.name).toLocaleLowerCase('zh-CN').includes(query)) return false;
    if (minPrice > 0 && itemPrice(item) < minPrice) return false;
    if (maxPrice > 0 && itemPrice(item) > maxPrice) return false;
    return true;
  });

  filtered.sort((left, right) => {
    if (sort === 'latest') {
      return itemLatest(right) - itemLatest(left) || compareName(left, right);
    }
    if (sort === 'price_desc') {
      return itemPrice(right) - itemPrice(left) || compareName(left, right);
    }
    return itemPrice(left) - itemPrice(right) || compareName(left, right);
  });
  return filtered;
}

function facets(items, kind = '') {
  const qualityCounts = new Map();
  const subtypeCounts = new Map();
  for (const item of items) {
    if (kind && item?.kind !== kind) continue;
    const quality = normalizedQuality(item?.quality);
    const subtype = normalized(item?.subtype);
    const weight = Math.max(1, Math.floor(number(item?.listing_count, 1)));
    if (quality) qualityCounts.set(quality, (qualityCounts.get(quality) || 0) + weight);
    if (subtype) subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + weight);
  }
  return {
    qualities: [...qualityCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => left.value.localeCompare(right.value, 'zh-CN')),
    subtypes: [...subtypeCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value, 'zh-CN')),
  };
}

function countsFrom(items, supplied = {}) {
  const counts = { ...supplied };
  if (Object.keys(counts).length) return counts;
  for (const item of items) {
    const kind = normalized(item?.kind);
    if (!kind) continue;
    counts[kind] = number(counts[kind], 0) + Math.max(1, Math.floor(number(item?.listing_count, 1)));
  }
  return counts;
}

export function createMarketBrowseStore({
  marketService,
  now = () => Date.now(),
  detailTtlMs = 30_000,
}) {
  if (!marketService) throw new Error('marketService is required');

  let snapshot = null;
  let pendingSnapshot = null;
  let generation = 0;
  const detailCache = new Map();
  const detailRequests = new Map();
  // Public browse is server-paged; the legacy complete snapshot is retained
  // only for the seller's local reference-price inspector.
  let visiblePage = null;
  let pageFilterKey = '';
  let pageGeneration = 0;
  const pageCache = new Map();
  const pageRequests = new Map();
  const pageMeta = new Map();
  const PAGE_SIZE = 50;
  const emptyPage = () => ({
    items: [], counts: {}, facets:{qualities:[],subtypes:[]},
    offset:0,next_offset:null,loaded_at:0,
  });

  async function fetchPage(filters = {}, offset = 0, { force = false } = {}) {
    const key = JSON.stringify(filters);
    const cacheKey = key+':'+offset;
    if (!force && pageCache.has(cacheKey)) {
      pageFilterKey = key;
      visiblePage = pageCache.get(cacheKey);
      return visiblePage;
    }
    if (!force && pageRequests.has(cacheKey)) return pageRequests.get(cacheKey);
    const requestId = ++pageGeneration;
    const request = Promise.resolve(marketService.catalog({...filters,limit:PAGE_SIZE,offset}))
      .then(next=>{
        if (requestId !== pageGeneration) return visiblePage;
        if (offset === 0) {
          pageMeta.set(key,{counts:{...(next?.counts||{})},
            facets:{...(next?.facets||{qualities:[],subtypes:[]})}});
          if (pageMeta.size>16) pageMeta.delete(pageMeta.keys().next().value);
        }
        const meta = pageMeta.get(key) || {counts:{},facets:{qualities:[],subtypes:[]}};
        visiblePage = {
          items:Array.isArray(next?.items)?next.items.slice():[],
          counts:{...meta.counts},facets:meta.facets,
          next_offset:next?.next_offset??null,offset,loaded_at:now(),
        };
        pageFilterKey=key;
        pageCache.set(cacheKey,visiblePage);
        if (pageCache.size>16) pageCache.delete(pageCache.keys().next().value);
        return visiblePage;
      }).finally(()=>{
        if(pageRequests.get(cacheKey)===request) pageRequests.delete(cacheKey);
      });
    pageRequests.set(cacheKey,request);
    return request;
  }

  async function ensurePage(filters = {}) {
    if (visiblePage && pageFilterKey===JSON.stringify(filters)) return visiblePage;
    return fetchPage(filters,0);
  }
  async function refreshPage(filters = {}) {
    return fetchPage(filters,0,{force:true});
  }
  function pageQuery(filters = {}) {
    return visiblePage && pageFilterKey===JSON.stringify(filters)
      ? visiblePage : emptyPage();
  }
  async function nextPage(filters = {}) {
    const current=await ensurePage(filters);
    return current?.next_offset==null?current:fetchPage(filters,current.next_offset);
  }
  async function previousPage(filters = {}) {
    const current=await ensurePage(filters);
    return !current?.offset?current:fetchPage(filters,Math.max(0,current.offset-PAGE_SIZE));
  }

  async function refresh() {
    if (pendingSnapshot) return pendingSnapshot;
    const requestGeneration = ++generation;
    const request = Promise.resolve(marketService.catalogSnapshot())
      .then(next => {
        if (requestGeneration !== generation) return snapshot;
        const items = Array.isArray(next?.items) ? next.items.slice() : [];
        snapshot = {
          items,
          counts: countsFrom(items, next?.counts || {}),
          loaded_at: now(),
        };
        return snapshot;
      }).finally(() => {
        if (pendingSnapshot === request) pendingSnapshot = null;
      });
    pendingSnapshot = request;
    return request;
  }

  async function ensureSnapshot() {
    return snapshot || pendingSnapshot || refresh();
  }

  // The complete catalog is small; filters and sorting are always local.
  async function append() {
    return ensureSnapshot();
  }

  function query(filters = {}) {
    const source = snapshot?.items || [];
    const kind = normalized(filters.kind);
    return {
      items: filterItems(source, filters),
      counts: { ...(snapshot?.counts || {}) },
      facets: facets(source, kind),
      next_offset: null,
      loaded_at: snapshot?.loaded_at || 0,
    };
  }

  function item(catalogKey) {
    const key = normalized(catalogKey);
    return snapshot?.items?.find(candidate => candidate?.key === key) || null;
  }

  function peekDetail(catalogKey) {
    const key = normalized(catalogKey);
    const cached = detailCache.get(key);
    return cached?.detail || null;
  }

  async function detail(catalogKey, { force = false } = {}) {
    const key = normalized(catalogKey);
    if (!key) throw new Error('catalogKey is required');

    const cached = detailCache.get(key);
    if (!force && cached && now() - cached.loaded_at <= detailTtlMs) {
      return cached.detail;
    }
    if (!force && detailRequests.has(key)) return detailRequests.get(key);

    const requestGeneration = generation;
    const request = Promise.resolve(marketService.catalogDetail(key))
      .then(result => {
        if (requestGeneration === generation) {
          detailCache.set(key, { detail: result, loaded_at: now() });
        }
        return result;
      })
      .finally(() => {
        detailRequests.delete(key);
      });
    detailRequests.set(key, request);
    return request;
  }

  function invalidate({ details = true } = {}) {
    visiblePage=null;pageFilterKey='';pageGeneration++;
    pageCache.clear();pageRequests.clear();pageMeta.clear();
    snapshot = null;
    pendingSnapshot = null;
    generation += 1;
    if (details) {
      detailCache.clear();
      detailRequests.clear();
    }
  }

  function invalidateDetail(catalogKey = '') {
    const key = normalized(catalogKey);
    if (!key) {
      detailCache.clear();
      detailRequests.clear();
      return;
    }
    detailCache.delete(key);
    detailRequests.delete(key);
  }

  return {
    refresh,
    ensureSnapshot,
    append,
    query,
    ensurePage,refreshPage,pageQuery,nextPage,previousPage,
    item,
    peekDetail,
    detail,
    invalidate,
    invalidateDetail,
  };
}
