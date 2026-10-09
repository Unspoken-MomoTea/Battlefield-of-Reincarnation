import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketBrowseStore } from '../views/market-browse-store.js';

const SNAPSHOT = {
  items: [
    {
      key: 'catalog:item:potion',
      kind: 'item',
      name: '治疗药剂',
      quality: 'E',
      subtype: '消耗品',
      lowest_price: 25,
      total_stock: 8,
      listing_count: 2,
      seller_count: 2,
      latest_at: 30,
      asset: { kind: 'item', name: '治疗药剂', data: { 品质: 'E', 类型: '消耗品' } },
    },
    {
      key: 'catalog:skill:focus',
      kind: 'skill',
      name: '专注',
      quality: 'F',
      subtype: '被动',
      lowest_price: 55,
      total_stock: 1,
      listing_count: 1,
      seller_count: 1,
      latest_at: 40,
      asset: { kind: 'skill', name: '专注', data: { 品质: 'F', 类型: 1 } },
    },
    {
      key: 'catalog:item:material',
      kind: 'item',
      name: '稀有材料',
      quality: 'D',
      subtype: '材料',
      lowest_price: 1000,
      total_stock: 3,
      listing_count: 1,
      seller_count: 1,
      latest_at: 20,
      asset: { kind: 'item', name: '稀有材料', data: { 品质: 'D', 类型: '材料' } },
    },
  ],
  counts: { item: 3, skill: 1 },
};

test('category, quality, sort and repeat switches never request catalog again', async () => {
  let catalogCalls = 0;
  const marketService = {
    async catalogSnapshot() {
      catalogCalls += 1;
      return structuredClone(SNAPSHOT);
    },
    async catalog() {
      throw new Error('clicking a category must not fetch a server page');
    },
    async catalogDetail() {
      throw new Error('detail not used');
    },
  };
  const store = createMarketBrowseStore({ marketService });
  await store.ensureSnapshot();
  assert.deepEqual(store.query({kind:'item', sort:'price_asc'}).items.map(x=>x.name),
    ['治疗药剂', '稀有材料']);
  assert.deepEqual(store.query({kind:'skill'}).items.map(x=>x.name), ['专注']);
  assert.deepEqual(store.query({kind:'item', quality:'D'}).items.map(x=>x.name), ['稀有材料']);
  assert.deepEqual(store.query({kind:'item', sort:'price_desc'}).items.map(x=>x.name),
    ['稀有材料', '治疗药剂']);
  await store.ensureSnapshot({kind:'skill'});
  await store.ensureSnapshot({kind:'item'});
  assert.equal(catalogCalls, 1);
  assert.equal(store.query().next_offset, null);
});

test('simultaneous snapshot loads coalesce to a single request', async () => {
  let resolve;
  let calls = 0;
  const store = createMarketBrowseStore({marketService: {
    catalogSnapshot() {
      calls += 1;
      return new Promise(r => { resolve = r; });
    },
    async catalogDetail() { return {}; },
  }});
  const one = store.ensureSnapshot();
  const two = store.ensureSnapshot({kind:'equipment'});
  assert.equal(calls, 1);
  resolve(structuredClone(SNAPSHOT));
  await Promise.all([one,two]);
  assert.equal(store.query().items.length, 3);
});

test('browse detail cache returns immediately after first fetch and refreshes only after ttl', async () => {
  let now = 1000;
  let snapshotCalls = 0;
  let detailCalls = 0;
  const marketService = {
    async catalogSnapshot() {
      snapshotCalls += 1;
      return structuredClone(SNAPSHOT);
    },
    async catalogDetail(key) {
      detailCalls += 1;
      return { catalog: SNAPSHOT.items.find(item => item.key === key), ladder: [], history: [] };
    },
  };
  const store = createMarketBrowseStore({
    marketService,
    now: () => now,
    detailTtlMs: 30_000,
  });

  await store.refresh();
  const first = await store.detail('catalog:item:potion');
  const second = await store.detail('catalog:item:potion');
  assert.equal(first, second);
  assert.equal(detailCalls, 1);

  now += 30_001;
  await store.detail('catalog:item:potion');
  assert.equal(detailCalls, 2);

  store.invalidate();
  await store.ensureSnapshot();
  assert.equal(snapshotCalls, 2);
});
