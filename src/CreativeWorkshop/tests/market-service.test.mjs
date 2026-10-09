import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketService, marketInventoryFromData } from '../services/market-service.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHost(initialStatData) {
  let current = { stat_data: clone(initialStatData) };
  let uuidSequence = 0;
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
    crypto: {
      randomUUID: () => {
        uuidSequence += 1;
        return '11111111-2222-4333-8444-' + String(uuidSequence).padStart(12, '0');
      },
    },
    read() { return clone(current); },
    events,
  };
}

test('market inventory excludes equipped gear and exposes all supported tradable assets', () => {
  const result = marketInventoryFromData({
    stat_data: {
      系统状态: { 是否在主神空间: true },
      角色: {
        空间币: 900,
        装备: {
          长剑: { 名称: '长剑', 品质: 'D', 状态: 0 },
          护甲: { 名称: '护甲', 品质: 'E', 状态: 1 },
          仓库枪: { 名称: '仓库枪', 品质: 'C', 状态: 2 },
        },
        道具: { 药剂: { 名称: '药剂', 品质: 'E', 数量: 3 } },
        技能: { 闪避: { 名称: '闪避', 品质: 'E' } },
        血统: { 龙血: { 品质: 'D', 描述: '测试血统' } },
        形态库: { 超载: { 层级: 'Ⅲ', 状态: '完好' } },
        权限凭证: { F: 2, S: 1 },
      },
      关系列表: {
        旅伴: { 是否队友: true, 层级: 'Ⅱ', 好感度: 50 },
        路人: { 是否队友: false, 层级: 'Ⅰ', 好感度: 0 },
      },
    },
  });

  assert.equal(result.inHub, true);
  assert.equal(result.coin, 900);
  assert.deepEqual(
    result.assets.map(asset => [asset.kind, asset.name, asset.quantity]),
    [
      ['equipment', '长剑', 1],
      ['equipment', '仓库枪', 1],
      ['item', '药剂', 3],
      ['skill', '闪避', 1],
      ['bloodline', '龙血', 1],
      ['form', '超载', 1],
      ['item', 'F级权限凭证', 2],
      ['item', 'S级权限凭证', 1],
      ['teammate', '旅伴', 1],
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
    async quoteMarketAction() {
      return { quote: { listing_fee: 6 } };
    },
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
  assert.equal(host.read().stat_data.角色.空间币, 994);
  assert.equal(posted.asset.quantity, 2);
  assert.equal(posted.asset.data.数量, 2);
  assert.equal(posted.unit_price, 120);
  assert.equal(posted.duration_hours, 24);
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


test('complete market snapshot follows pagination once and exposes all listings to the view', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: { 空间币: 0, 装备: {}, 道具: {}, 技能: {} },
  });
  const calls = [];
  const api = {
    async listMarketListings(input) {
      calls.push(clone(input));
      if (input.offset === 0) {
        return { items: [{ id: 'a' }, { id: 'b' }], next_offset: 2 };
      }
      return { items: [{ id: 'c' }], next_offset: null };
    },
  };

  const market = createMarketService({ host, api });
  const items = await market.listAll();

  assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c']);
  assert.deepEqual(calls, [
    { sort: 'latest', offset: 0, limit: 60 },
    { sort: 'latest', offset: 2, limit: 60 },
  ]);
});


test('system credential delivery writes the dedicated credential ledger instead of item inventory', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 100,
      权限凭证: { F: 1 },
      装备: {},
      道具: {},
      技能: {},
    },
  });
  const api = {
    async confirmMarketDelivery() { return {}; },
  };
  const market = createMarketService({ host, api });
  await market.deliverTrade({
    id: 'trade:credential',
    asset: {
      kind: 'item',
      name: 'F级权限凭证',
      quantity: 2,
      data: {
        品质: 'F',
        类型: '权限凭证',
        标签: ['主神空间', '权限凭证'],
      },
    },
  });

  const saved = host.read().stat_data.角色;
  assert.equal(saved.权限凭证.F, 3);
  assert.equal(saved.道具['F级权限凭证'], undefined);
});

test('equipment can be removed locally, recycled by the system and paid out idempotently', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 10,
      装备: { 旧剑: { 名称: '旧剑', 品质: 'F', 类型: 0, 状态: 0 } },
      道具: {},
      技能: {},
    },
  });
  let posted = null;
  const api = {
    async createMarketBuyback(input) {
      posted = clone(input);
      return {
        buyback: { id: input.id, amount: 3 },
        payout: { id: input.id, amount: 3, confirmed_at: null },
      };
    },
    async getMarketBuyback() { throw new Error('not needed'); },
    async confirmMarketPayout() { return {}; },
  };
  const market = createMarketService({ host, api });
  await market.sellToSystem({
    kind: 'equipment',
    key: '旧剑',
    name: '旧剑',
  });

  const saved = host.read().stat_data.角色;
  assert.equal(saved.装备.旧剑, undefined);
  assert.equal(saved.空间币, 13);
  assert.equal(posted.asset.kind, 'equipment');
  assert.match(posted.id, /^buyback:/u);
});


test('selling an active form clears current form and selling a teammate removes the relation record', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 1000,
      装备: {},
      道具: {},
      技能: {},
      血统: {},
      形态库: { 超载: { 层级: 'Ⅱ', 状态: '完好' } },
      当前形态: { 激活: true, 名称: '超载' },
    },
    关系列表: {
      旅伴: { 是否队友: true, 层级: 'Ⅱ', 好感度: 50 },
    },
  });
  const listings = [];
  const api = {
    async quoteMarketAction() { return { quote: { listing_fee: 1 } }; },
    async createMarketListing(input) {
      listings.push(clone(input));
      return { listing: { id: input.id, asset: input.asset } };
    },
    async getMarketMe() { return { listings: [] }; },
  };
  const market = createMarketService({ host, api });

  await market.sell({
    kind: 'form',
    key: '超载',
    name: '超载',
    unitPrice: 100,
    durationHours: 24,
  });
  let saved = host.read().stat_data;
  assert.equal(saved.角色.形态库.超载, undefined);
  assert.deepEqual(saved.角色.当前形态, { 激活: false, 名称: '' });

  await market.sell({
    kind: 'teammate',
    key: '旅伴',
    name: '旅伴',
    unitPrice: 200,
    durationHours: 24,
  });
  saved = host.read().stat_data;
  assert.equal(saved.关系列表.旅伴, undefined);
  assert.deepEqual(listings.map(value => value.asset.kind), ['form', 'teammate']);
  const teammateListing = listings.find(value => value.asset.kind === 'teammate');
  assert.equal(teammateListing.asset.data.好感度, 0);
  assert.equal(teammateListing.asset.data.态度, '被交易的货物，对原主失去一切信任');
});

test('permission credentials can be listed from the account ledger at every owned quality', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 1000,
      权限凭证: { S: 2 },
      装备: {}, 道具: {}, 技能: {}, 血统: {}, 形态库: {},
    },
    关系列表: {},
  });
  let posted = null;
  const api = {
    async quoteMarketAction() { return { quote: { listing_fee: 1 } }; },
    async createMarketListing(input) {
      posted = clone(input);
      return { listing: { id: input.id, asset: input.asset } };
    },
    async getMarketMe() { return { listings: [] }; },
  };
  const market = createMarketService({ host, api });
  const credential = (await market.inventory()).assets.find(asset => asset.name === 'S级权限凭证');
  assert.ok(credential);

  await market.sell({
    kind: credential.kind,
    key: credential.key,
    name: credential.name,
    quantity: 1,
    unitPrice: 320000,
    durationHours: 24,
  });

  assert.equal(host.read().stat_data.角色.权限凭证.S, 1);
  assert.equal(posted.asset.data.类型, '权限凭证');
  assert.equal(posted.asset.data.数量, 1);
});

test('items and teammates can be sold directly to the system, including stacked item quantity', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 10,
      装备: {},
      道具: { 材料: { 名称: '材料', 品质: 'F', 数量: 4 } },
      技能: {},
      血统: {},
      形态库: {},
    },
    关系列表: {
      旅伴: { 是否队友: true, 层级: 'Ⅱ', 好感度: 30 },
    },
  });
  const posted = [];
  const api = {
    async createMarketBuyback(input) {
      posted.push(clone(input));
      const amount = input.asset.kind === 'item' ? 6 : 35;
      return {
        buyback: { id: input.id, amount },
        payout: { id: input.id, amount, confirmed_at: null },
      };
    },
    async getMarketBuyback() { throw new Error('not needed'); },
    async confirmMarketPayout() { return {}; },
  };
  const market = createMarketService({ host, api });

  await market.sellToSystem({
    kind: 'item',
    key: '材料',
    name: '材料',
    quantity: 2,
  });
  assert.equal(host.read().stat_data.角色.道具.材料.数量, 2);

  await market.sellToSystem({
    kind: 'teammate',
    key: '旅伴',
    name: '旅伴',
  });
  const saved = host.read().stat_data;
  assert.equal(saved.关系列表.旅伴, undefined);
  assert.equal(saved.角色.空间币, 51);
  assert.deepEqual(posted.map(value => [value.asset.kind, value.asset.quantity]), [
    ['item', 2],
    ['teammate', 1],
  ]);
});


test('failed teammate auction restores the original trust state instead of the listing snapshot', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 1000,
      装备: {}, 道具: {}, 技能: {}, 血统: {}, 形态库: {},
    },
    关系列表: {
      旅伴: {
        是否队友: true,
        层级: 'Ⅱ',
        好感度: 75,
        态度: '完全信任原主',
      },
    },
  });
  const api = {
    async quoteMarketAction() { return { quote: { listing_fee: 1 } }; },
    async createMarketListing() { throw new Error('network failed'); },
    async getMarketMe() { return { listings: [] }; },
  };
  const market = createMarketService({ host, api });

  await assert.rejects(
    () => market.sell({
      kind: 'teammate',
      key: '旅伴',
      name: '旅伴',
      unitPrice: 200,
      durationHours: 24,
    }),
    /network failed/u,
  );

  const restored = host.read().stat_data.关系列表.旅伴;
  assert.equal(restored.好感度, 75);
  assert.equal(restored.态度, '完全信任原主');
  assert.equal(host.read().stat_data.角色.空间币, 1000);
});


test('buy order escrow deducts local coins and cancellation refund is written back once', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 500,
      装备: {}, 道具: {}, 技能: {}, 血统: {}, 形态库: {},
    },
    关系列表: {},
  });
  let created = null;
  const api = {
    async createMarketBuyOrder(input) {
      created = clone(input);
      return {
        order: {
          id: input.id,
          asset_kind: input.kind,
          asset_name: input.name,
          quantity: input.quantity,
          unit_price: input.unit_price,
        },
      };
    },
    async getMarketBuyOrder() { throw new Error('not needed'); },
    async cancelMarketBuyOrder(orderId) {
      return {
        order: { id: orderId, status: 'cancelled' },
        payout: { id: 'order-refund:test', amount: 150, confirmed_at: null },
      };
    },
    async confirmMarketPayout() { return {}; },
  };
  const market = createMarketService({ host, api });

  const result = await market.createBuyOrder({
    kind: 'item',
    name: '求购材料',
    quality: 'E',
    subtype: '材料',
    quantity: 3,
    unitPrice: 50,
    durationHours: 24,
  });
  assert.ok(result.order.id);
  assert.equal(created.unit_price, 50);
  assert.equal(host.read().stat_data.角色.空间币, 350);

  await market.cancelBuyOrder(result.order.id);
  assert.equal(host.read().stat_data.角色.空间币, 500);
});

test('filling a buy order removes only the delivered local stack and preserves teammate trade reset', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 0,
      装备: {},
      道具: { 材料: { 名称: '材料', 品质: 'E', 类型: '材料', 数量: 5 } },
      技能: {}, 血统: {}, 形态库: {},
    },
    关系列表: {
      旅伴: { 是否队友: true, 层级: 'Ⅱ', 好感度: 80, 态度: '信任' },
    },
  });
  const fills = [];
  const api = {
    async fillMarketBuyOrder(orderId, input) {
      fills.push(clone({ orderId, input }));
      return { fill: { id: input.fill_id, asset: input.asset } };
    },
    async getMarketMe() { return { order_fills: [] }; },
  };
  const market = createMarketService({ host, api });

  await market.fillBuyOrder({
    id: 'order:item',
    asset_kind: 'item',
    asset_name: '材料',
    remaining_quantity: 3,
  }, {
    kind: 'item',
    key: '材料',
    name: '材料',
    quantity: 2,
  });
  assert.equal(host.read().stat_data.角色.道具.材料.数量, 3);
  assert.equal(fills[0].input.asset.quantity, 2);

  await market.fillBuyOrder({
    id: 'order:teammate',
    asset_kind: 'teammate',
    asset_name: '旅伴',
    remaining_quantity: 1,
  }, {
    kind: 'teammate',
    key: '旅伴',
    name: '旅伴',
  });
  assert.equal(host.read().stat_data.关系列表.旅伴, undefined);
  assert.equal(fills[1].input.asset.data.好感度, 0);
  assert.equal(fills[1].input.asset.data.态度, '被交易的货物，对原主失去一切信任');
});

test('failed swap creation restores escrowed local asset while successful transfer delivery is idempotent', async () => {
  const host = createHost({
    系统状态: { 是否在主神空间: true },
    角色: {
      空间币: 0,
      装备: {},
      道具: { 药剂: { 名称: '药剂', 品质: 'F', 类型: '消耗品', 数量: 2 } },
      技能: {}, 血统: {}, 形态库: {},
    },
    关系列表: {},
  });
  let confirmCount = 0;
  const api = {
    async createMarketSwap() { throw new Error('swap network failed'); },
    async getMarketSwap() { throw new Error('missing'); },
    async confirmMarketSwapTransfer() { confirmCount += 1; return {}; },
  };
  const market = createMarketService({ host, api });

  await assert.rejects(
    () => market.createSwap({
      offered: { kind: 'item', key: '药剂', name: '药剂', quantity: 2 },
      wanted: { kind: 'item', name: '材料', quality: 'E', subtype: '材料', quantity: 1 },
      durationHours: 24,
    }),
    /swap network failed/u,
  );
  assert.equal(host.read().stat_data.角色.道具.药剂.数量, 2);

  const transfer = {
    id: 'swap-transfer:test',
    asset: {
      kind: 'item',
      name: '材料',
      quantity: 1,
      data: { 名称: '材料', 品质: 'E', 类型: '材料', 数量: 1 },
    },
  };
  await market.receiveSwapTransfer(transfer);
  await market.receiveSwapTransfer(transfer);
  assert.equal(host.read().stat_data.角色.道具.材料.数量, 1);
  assert.equal(confirmCount, 2);
});
