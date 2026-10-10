import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMarketRows,
  filterMarketRows,
  marketAssetDetailEntries,
  marketAssetFieldDisplay,
  marketInventoryMatchesWanted,
  marketPriceLadder,
  marketRowFromCatalogDetail,
  marketTeammateDetailModel,
  planMarketPurchase,
} from '../views/market-model.js';

function listing(id, sellerId, price, stock, name = '治疗药剂') {
  return {
    id,
    unit_price: price,
    remaining_quantity: stock,
    created_at: 1,
    seller: { id: sellerId, display_name: 'Seller ' + sellerId },
    asset: {
      kind: 'item',
      name,
      data: { 名称: name, 品质: 'F', 数量: stock },
    },
  };
}

test('auction rows merge same-name commodities but keep equipment listings separate', () => {
  const rows = buildMarketRows([
    listing('a', 1, 25, 4),
    listing('b', 2, 30, 6),
    {
      id: 'equip-a',
      unit_price: 100,
      remaining_quantity: 1,
      created_at: 1,
      seller: { id: 1 },
      asset: { kind: 'equipment', name: '铁剑', data: { 品质: 'F' } },
    },
    {
      id: 'equip-b',
      unit_price: 120,
      remaining_quantity: 1,
      created_at: 1,
      seller: { id: 2 },
      asset: { kind: 'equipment', name: '铁剑', data: { 品质: 'F' } },
    },
  ], 99);

  assert.equal(rows.length, 3);
  const potion = rows.find(row => row.kind === 'item');
  assert.equal(potion.totalStock, 10);
  assert.equal(potion.lowestPrice, 25);
  assert.equal(potion.sellerCount, 2);
  assert.equal(rows.filter(row => row.kind === 'equipment').length, 2);
});

test('purchase plan consumes cheapest commodity listings first and skips own auctions', () => {
  const row = buildMarketRows([
    listing('mine', 7, 20, 5),
    listing('cheap', 8, 25, 2),
    listing('next', 9, 30, 5),
  ], 7)[0];

  const plan = planMarketPurchase(row, 4, 7);
  assert.equal(plan.quantity, 4);
  assert.equal(plan.total, 110);
  assert.deepEqual(
    plan.lines.map(line => [line.listing.id, line.quantity, line.subtotal]),
    [
      ['cheap', 2, 50],
      ['next', 2, 60],
    ],
  );
});

test('price ladder aggregates sellers at the same unit price', () => {
  const row = buildMarketRows([
    listing('a', 1, 25, 2),
    listing('b', 2, 25, 3),
    listing('c', 3, 30, 4),
  ], 99)[0];

  assert.deepEqual(marketPriceLadder(row, 99), [
    { price: 25, stock: 5, sellerCount: 2 },
    { price: 30, stock: 4, sellerCount: 1 },
  ]);
});


test('cached auction rows filter, search and sort without rebuilding server queries', () => {
  const rows = buildMarketRows([
    listing('item-a', 1, 30, 2, '治疗药剂'),
    listing('item-b', 2, 25, 3, '治疗药剂'),
    {
      id: 'equip-a',
      unit_price: 80,
      remaining_quantity: 1,
      created_at: 9,
      seller: { id: 3 },
      asset: { kind: 'equipment', name: '铁剑', data: { 品质: 'E' } },
    },
    {
      id: 'skill-a',
      unit_price: 50,
      remaining_quantity: 1,
      created_at: 12,
      seller: { id: 4 },
      asset: { kind: 'skill', name: '疾步', data: { 品质: 'F' } },
    },
  ], 99);

  assert.deepEqual(
    filterMarketRows(rows, { kind: 'item', sort: 'price_asc' }).map(row => row.name),
    ['治疗药剂'],
  );
  assert.deepEqual(
    filterMarketRows(rows, { query: '铁', sort: 'price_asc' }).map(row => row.name),
    ['铁剑'],
  );
  assert.deepEqual(
    filterMarketRows(rows, { sort: 'price_desc' }).map(row => row.name),
    ['铁剑', '疾步', '治疗药剂'],
  );
  assert.deepEqual(
    filterMarketRows(rows, { sort: 'latest' }).map(row => row.name),
    ['疾步', '铁剑', '治疗药剂'],
  );
});


test('market asset display translates equipment, skill and status enums', () => {
  assert.equal(marketAssetFieldDisplay({ kind: 'equipment' }, '类型', 0), '武器');
  assert.equal(marketAssetFieldDisplay({ kind: 'equipment' }, '类型', 8), '世界遗物');
  assert.equal(marketAssetFieldDisplay({ kind: 'skill' }, '类型', 1), '被动');
  assert.equal(marketAssetFieldDisplay({ kind: 'item' }, '类型', '材料'), '材料');
  assert.equal(marketAssetFieldDisplay({ kind: 'equipment' }, '状态', 2), '仓库');
});


test('market detail hides true stats, technical credential fields and empty values', () => {
  const entries = marketAssetDetailEntries({
    kind: 'equipment',
    data: {
      品质: 'E',
      原始属性: {},
      真属性: { ATK: 999 },
      效果: { 主效果: '', 副效果: null },
      描述: '有效描述',
      消耗: '',
      状态: 0,
      系统商品: 'permission_credential',
      凭证品质: 'E',
      标签: ['主神空间'],
    },
  });

  assert.deepEqual(entries, [
    ['品质', 'E'],
    ['描述', '有效描述'],
    ['状态', 0],
    ['标签', ['主神空间']],
  ]);
});


test('teammate detail omits combat caches and compacts nested build data', () => {
  const detail = marketTeammateDetailModel({
    kind: 'teammate',
    data: {
      在场: false,
      是否队友: true,
      层级: 'Ⅱ',
      种族: '灵狐',
      身份: ['侦察员', '旅伴'],
      职业: {
        游侠: { 类型: '战斗', 特性: ['追踪'] },
      },
      HP_MAX: 40,
      HP: 40,
      THP: 0,
      EP_MAX: 24,
      EP: 24,
      最终属性: { 力量: 4, ATK: 2 },
      血统: { 灵狐血统: { 品质: 'E', 真属性: { 力量: 5 } } },
      技能: { 追踪: { 品质: 'E' }, 夜行: { 品质: 'F' } },
      装备: { 短弓: { 品质: 'E', 状态: 1 } },
      道具: { 绷带: { 品质: 'F', 数量: 3 } },
      形态库: { 月影: { 层级: 'Ⅱ' } },
      状态: { 警觉: { 品质: 'F' } },
      当前形态: { 激活: true, 名称: '月影' },
      性格: '谨慎',
      外貌: '银发狐耳',
      背景故事: '来自边境。',
      好感度: 0,
      态度: '被交易的货物，对原主失去一切信任',
    },
  });

  assert.deepEqual(detail.overview, [['层级', 'Ⅱ'], ['种族', '灵狐']]);
  assert.deepEqual(detail.identity, ['侦察员', '旅伴']);
  assert.deepEqual(detail.occupations, [{ name: '游侠', meta: '战斗' }]);
  assert.deepEqual(detail.builds[0], ['血统', [{ name: '灵狐血统', rank: 'E', quantity: 1 }]]);
  assert.deepEqual(
    detail.builds.find(([label]) => label === '道具'),
    ['道具', [{ name: '绷带', rank: 'F', quantity: 3 }]],
  );
  assert.equal(detail.currentForm, '月影');
  assert.equal(detail.extra.some(([key]) => ['HP', 'HP_MAX', 'THP', 'EP', 'EP_MAX', '最终属性'].includes(key)), false);
});

test('generic market detail also hides hp ep thp and final attribute caches', () => {
  const entries = marketAssetDetailEntries({
    kind: 'teammate',
    data: {
      层级: 'Ⅰ',
      HP_MAX: 40,
      HP: 35,
      THP: 5,
      EP_MAX: 20,
      EP: 10,
      最终属性: { ATK: 9 },
      描述: '保留信息',
    },
  });

  assert.deepEqual(entries, [
    ['层级', 'Ⅰ'],
    ['描述', '保留信息'],
  ]);
});


test('server catalog detail becomes a purchase row without downloading the whole market', () => {
  const row = marketRowFromCatalogDetail({
    catalog: {
      key: 'catalog:item:test',
      kind: 'item',
      name: '治疗药剂',
      total_stock: 8,
      lowest_price: 25,
      seller_count: 3,
      asset: { kind: 'item', name: '治疗药剂', quantity: 8, data: { 品质: 'F', 类型: '消耗品' } },
    },
    listings: [
      { id: 'mine', unit_price: 20, remaining_quantity: 2, seller: { id: 7 } },
      { id: 'cheap', unit_price: 25, remaining_quantity: 3, seller: { id: 8 } },
      { id: 'next', unit_price: 30, remaining_quantity: 3, seller: { id: 9 } },
    ],
  }, 7);

  assert.equal(row.key, 'catalog:item:test');
  assert.equal(row.buyableStock, 6);
  assert.equal(row.buyPrice, 25);
  assert.equal(row.ownedOnly, false);
  const plan = planMarketPurchase(row, 4, 7);
  assert.equal(plan.total, 105);
  assert.deepEqual(plan.lines.map(line => [line.listing.id, line.quantity]), [
    ['cheap', 3],
    ['next', 1],
  ]);
});

test('order matching respects logical kind, exact name, rank quality and subtype', () => {
  const assets = [
    { kind: 'item', name: '灵药', quality: 'E', data: { 品质: 'E', 类型: '消耗品' } },
    { kind: 'item', name: '灵药', quality: 'D', data: { 品质: 'D', 类型: '消耗品' } },
    { kind: 'teammate', name: '灵药', quality: 'E', data: { 层级: 'Ⅱ' } },
    { kind: 'form', name: '月影', quality: 'Ⅱ', data: { 层级: 'Ⅱ', 类型: '战斗形态' } },
  ];

  assert.deepEqual(
    marketInventoryMatchesWanted(assets, {
      kind: 'item',
      name: '灵药',
      quality: 'E',
      subtype: '消耗品',
    }).map(asset => asset.quality),
    ['E'],
  );
  assert.deepEqual(
    marketInventoryMatchesWanted(assets, {
      kind: 'form',
      name: '月影',
      quality: 'E',
      subtype: '战斗形态',
    }).map(asset => asset.name),
    ['月影'],
  );
});

test('asset detail does not repeat names but preserves real raw attributes', () => {
  const entries = marketAssetDetailEntries({
    kind: 'equipment',
    name: '测试铁剑',
    data: {
      名称: '测试铁剑',
      品质: 'D',
      原始属性: { 力量: 'D', 攻击: 'E', 体质: 5 },
      真属性: { ATK: 999 },
      最终属性: { 力量: 99 },
    },
  });
  assert.deepEqual(entries, [
    ['品质', 'D'],
    ['原始属性', { 力量: 'D', 攻击: 'E', 体质: 5 }],
  ]);
});

test('teammate detail preserves personal and nested build raw attributes', () => {
  const model = marketTeammateDetailModel({
    kind: 'teammate',
    name: '灵鸟',
    data: {
      层级: 'Ⅱ', 原始属性: { 力量: 'F', 敏捷: 'D' },
      血统: { 人类血统: {
        品质: 'F', 原始属性: { 体质: 'E', 力量: 'D' },
        真属性: { 力量: 20 },
      } },
      装备: { 羽刃: { 品质: 'E', 原始属性: { 攻击: 'C' } } },
    },
  });
  assert.deepEqual(model.rawAttributes, [
    { name: '力量', value: 'F' }, { name: '敏捷', value: 'D' },
  ]);
  assert.deepEqual(model.builds.find(([kind]) => kind === '血统')[1][0].rawAttributes, [
    { name: '体质', value: 'E' }, { name: '力量', value: 'D' },
  ]);
  assert.deepEqual(model.builds.find(([kind]) => kind === '装备')[1][0].rawAttributes, [
    { name: '攻击', value: 'C' },
  ]);
});
