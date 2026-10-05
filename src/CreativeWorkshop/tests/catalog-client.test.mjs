import assert from 'node:assert/strict';
import test from 'node:test';

import { filterAndPageCatalog } from '../services/projects/catalog.js';

const items = [
  { id: 'a', name: '刀剑伙伴', summary: '高速近战', owner_name: 'Alice', tags: ['近战'], category: 'character', kind: 'opening_partner', updated_at: 10, downloads_count: 5, likes_count: 2, favorites_count: 1 },
  { id: 'b', name: '魔法商店', summary: '出售法术', owner_name: 'Bob', tags: ['法术', '商店'], category: 'extension', kind: 'store_catalog', updated_at: 20, downloads_count: 1, likes_count: 9, favorites_count: 3 },
  { id: 'c', name: '刀剑设定', summary: '世界书角色', owner_name: 'Carol', tags: ['剧情'], category: 'character', kind: 'world_character', updated_at: 30, downloads_count: 30, likes_count: 1, favorites_count: 0 },
];

test('catalog search/filter/sort runs fully in the client list', () => {
  const result = filterAndPageCatalog(items, {
    query: '刀剑',
    category: 'character',
    kind: '',
    tag: '',
    sort: 'latest',
    offset: 0,
    limit: 24,
  });
  assert.deepEqual(result.items.map(item => item.id), ['c', 'a']);
  assert.equal(result.next_offset, null);
});

test('catalog search covers author and tags and keeps paging local', () => {
  assert.deepEqual(
    filterAndPageCatalog(items, { query: 'Alice', sort: 'latest', offset: 0, limit: 24 }).items.map(item => item.id),
    ['a'],
  );
  assert.deepEqual(
    filterAndPageCatalog(items, { tag: '商店', sort: 'latest', offset: 0, limit: 24 }).items.map(item => item.id),
    ['b'],
  );
  const page = filterAndPageCatalog(items, { sort: 'downloads', offset: 0, limit: 2 });
  assert.deepEqual(page.items.map(item => item.id), ['c', 'a']);
  assert.equal(page.next_offset, 2);
});


test('dependency picker also searches the shared catalog instead of the D1-backed list endpoint', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const source = fs.readFileSync(
    fileURLToPath(new URL('../ui/dependency-picker.js', import.meta.url)),
    'utf8',
  );
  assert.match(source, /getProjectCatalog\(\)/u);
  assert.match(source, /filterAndPageCatalog\(/u);
  assert.doesNotMatch(source, /workshopApi\.listProjects\(/u);
});


test('popular recommendations do not collapse into raw download ranking and stay stable within a day', () => {
  const nowSeconds = 1_800_000_000;
  const candidates = [
    {
      id: 'old-download-hit',
      name: '旧热门',
      created_at: nowSeconds - 400 * 86400,
      updated_at: nowSeconds - 200 * 86400,
      downloads_count: 500,
      likes_count: 1,
      favorites_count: 1,
    },
    {
      id: 'fresh-player-pick',
      name: '新作口碑',
      created_at: nowSeconds - 3 * 86400,
      updated_at: nowSeconds - 2 * 86400,
      downloads_count: 30,
      likes_count: 12,
      favorites_count: 10,
    },
  ];
  const realNow = Date.now;
  Date.now = () => nowSeconds * 1000;
  try {
    const downloads = filterAndPageCatalog(candidates, { sort: 'downloads' }).items.map(item => item.id);
    const popularA = filterAndPageCatalog(candidates, { sort: 'popular' }).items.map(item => item.id);
    const popularB = filterAndPageCatalog(candidates, { sort: 'popular' }).items.map(item => item.id);

    assert.deepEqual(downloads, ['old-download-hit', 'fresh-player-pick']);
    assert.deepEqual(popularA, ['fresh-player-pick', 'old-download-hit']);
    assert.deepEqual(popularB, popularA);
  } finally {
    Date.now = realNow;
  }
});
