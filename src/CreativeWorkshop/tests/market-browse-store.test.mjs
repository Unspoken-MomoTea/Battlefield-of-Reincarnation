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

test('browse snapshot filters and sorts locally without refetching the server', async () => {
  let snapshotCalls = 0;
  const marketService = {
    async catalogSnapshot() {
      snapshotCalls += 1;
      return structuredClone(SNAPSHOT);
    },
    async catalogDetail() {
      throw new Error('detail not used');
    },
  };
  const store = createMarketBrowseStore({ marketService });

  await store.refresh();
  assert.equal(snapshotCalls, 1);

  assert.deepEqual(
    store.query({ kind: 'item', sort: 'price_asc' }).items.map(item => item.name),
    ['治疗药剂', '稀有材料'],
  );
  assert.deepEqual(
    store.query({ kind: 'skill', sort: 'price_asc' }).items.map(item => item.name),
    ['专注'],
  );
  assert.deepEqual(
    store.query({ query: '材料', quality: 'D', minPrice: 900, maxPrice: 1200 }).items.map(item => item.name),
    ['稀有材料'],
  );
  assert.equal(snapshotCalls, 1);
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
