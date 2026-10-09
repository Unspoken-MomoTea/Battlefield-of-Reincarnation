import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMarketRows,
  filterMarketRows,
  marketAssetFieldDisplay,
  marketPriceLadder,
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
