import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketService, marketInventoryFromData } from '../services/market-service.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHost(initialStatData) {
  let current = { stat_data: clone(initialStatData) };
  const events = [];
  const Mvu = {
    events: { VARIABLE_UPDATE_ENDED: 'VARIABLE_UPDATE_ENDED' },
    getMvuData() {
      return clone(current);
    },
    async replaceMvuData(next, target) {
      if (target?.type === 'message') current = clone(next);
    },
  };
  return {
    Mvu,
    eventEmit(...args) { events.push(args); },
    crypto: { randomUUID: () => '11111111-2222-4333-8444-555555555555' },
    read() { return clone(current); },
    events,
  };
}

test('market inventory exposes tradable equipment, items, skills and current space coin', () => {
  const result = marketInventoryFromData({
    stat_data: {
      系统状态: { 是否在主神空间: true },
      角色: {
        空间币: 900,
        装备: { 长剑: { 名称: '长剑', 品质: 'D' } },
        道具: { 药剂: { 名称: '药剂', 品质: 'E', 数量: 3 } },
        技能: { 闪避: { 名称: '闪避', 品质: 'E' } },
      },
    },
  });

  assert.equal(result.inHub, true);
  assert.equal(result.coin, 900);
  assert.deepEqual(
    result.assets.map(asset => [asset.kind, asset.name, asset.quantity]),
    [
      ['equipment', '长剑', 1],
      ['item', '药剂', 3],
      ['skill', '闪避', 1],
    ],
  );
});

test('selling a stack removes only the listed quantity before creating the server listing', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 1000,
      装备: {},
      道具: { 药剂: { 名称: '药剂', 品质: 'E', 数量: 5 } },
      技能: {},
    },
  });
  let posted = null;
  const api = {
    async createMarketListing(input) {
      posted = clone(input);
      return {
        listing: {
          id: input.id,
          asset: input.asset,
          unit_price: input.unit_price,
          remaining_quantity: input.asset.quantity,
        },
      };
    },
    async getMarketMe() { return { listings: [] }; },
  };

  const market = createMarketService({ host, api });
  await market.sell({
    kind: 'item',
    key: '药剂',
    name: '药剂',
    quantity: 2,
    unitPrice: 120,
  });

  assert.equal(host.read().stat_data.角色.道具.药剂.数量, 3);
  assert.equal(posted.asset.quantity, 2);
  assert.equal(posted.asset.data.数量, 2);
  assert.equal(posted.unit_price, 120);
  assert.match(posted.id, /^listing:/u);
});

test('purchase deducts space coin, adds the bought item and confirms delivery', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 500,
      装备: {},
      道具: {},
      技能: {},
    },
  });
  const confirmations = [];
  const api = {
    async buyMarketListing(listingId, input) {
      return {
        trade: {
          id: input.trade_id,
          listing_id: listingId,
          quantity: input.quantity,
          total_price: 200,
          asset: {
            kind: 'item',
            name: '绷带',
            quantity: input.quantity,
            data: { 名称: '绷带', 品质: 'F', 数量: input.quantity },
          },
        },
      };
    },
    async confirmMarketDelivery(tradeId) {
      confirmations.push(tradeId);
      return { trade: { id: tradeId } };
    },
    async getMarketTrade() {
      throw new Error('not needed');
    },
  };
  const market = createMarketService({ host, api });

  const listing = {
    id: 'listing:test-1',
    unit_price: 100,
    remaining_quantity: 5,
    asset: {
      kind: 'item',
      name: '绷带',
      quantity: 5,
      data: { 名称: '绷带', 品质: 'F', 数量: 5 },
    },
    seller: { id: 2 },
  };

  await market.buy(listing, 2);

  const saved = host.read();
  assert.equal(saved.stat_data.角色.空间币, 300);
  assert.equal(saved.stat_data.角色.道具.绷带.数量, 2);
  assert.equal(confirmations.length, 1);
  assert.match(confirmations[0], /^trade:/u);
});

test('repeating local delivery does not duplicate an already applied asset', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 10,
      装备: {},
      道具: {},
      技能: {},
    },
  });
  let confirmations = 0;
  const api = {
    async confirmMarketDelivery() {
      confirmations += 1;
      return {};
    },
  };
  const market = createMarketService({ host, api });
  const trade = {
    id: 'trade:idempotent',
    asset: {
      kind: 'item',
      name: '测试材料',
      quantity: 3,
      data: { 名称: '测试材料', 数量: 3 },
    },
  };

  await market.deliverTrade(trade);
  await market.deliverTrade(trade);

  const saved = host.read();
  assert.equal(saved.stat_data.角色.道具.测试材料.数量, 3);
  assert.equal(confirmations, 2);
  assert.ok(saved.__reincarnationMarketLedger.deliveries['trade:idempotent']);
});

test('trade-changing operations are blocked outside the hub', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: false },
    角色: {
      空间币: 500,
      装备: {},
      道具: { 药剂: { 名称: '药剂', 数量: 1 } },
      技能: {},
    },
  });
  const market = createMarketService({
    host,
    api: {
      async createMarketListing() {
        throw new Error('should not call server');
      },
    },
  });

  await assert.rejects(
    () => market.sell({
      kind: 'item',
      key: '药剂',
      name: '药剂',
      quantity: 1,
      unitPrice: 50,
    }),
    /只允许在主神空间/u,
  );
});
