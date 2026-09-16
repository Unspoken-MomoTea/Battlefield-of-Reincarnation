const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../World Book/[variables]当前变量.txt'), 'utf8');
const identityStart = source.indexOf('const playerIdentityNames');
const identityEnd = source.indexOf('const deadAlienNameKeys', identityStart);
const assetStart = source.indexOf('const stripHarvestFields');
const assetEnd = source.indexOf('// 7. 系统状态', assetStart);
assert.ok(identityStart >= 0 && identityEnd > identityStart && assetStart >= 0 && assetEnd > assetStart);

const clone = value => JSON.parse(JSON.stringify(value));
const lodash = {
  cloneDeep: clone,
  isEmpty: value => !value || Object.keys(value).length === 0,
  mapValues: (value, mapper) => Object.fromEntries(Object.entries(value || {}).map(([key, item]) => [key, mapper(item, key)])),
  omit: (value, keys) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !keys.includes(key))),
  pickBy: (value, predicate) => Object.fromEntries(Object.entries(value || {}).filter(([, item]) => predicate(item))),
  transform: (value, iteratee, result) => {
    for (const [key, item] of Object.entries(value || {})) iteratee(result, item, key);
    return result;
  },
};

const renderAssets = new Function(
  'tavernPlayerName', 'data', '_', 'isCombat', 'isWorldEngineEnabled', 'current',
  source.slice(identityStart, identityEnd) + source.slice(assetStart, assetEnd) + '; return current.资产 || {};',
);

const data = {
  资产: {
    玩家庄园: { 所属对象: ['测试玩家'], 类型: '固定地产' },
    共管基地: { 所属对象: ['盟友', '测试玩家'], 类型: '要塞' },
    敌军据点: { 所属对象: ['敌军'], 类型: '要塞' },
    无主遗迹: { 所属对象: [], 类型: '固定地产' },
  },
};

assert.deepEqual(
  Object.keys(renderAssets('测试玩家', clone(data), lodash, false, true, {})),
  ['玩家庄园', '共管基地'],
  '世界推进开启时，正文只能读取玩家拥有或共管的资产',
);
assert.deepEqual(
  Object.keys(renderAssets('测试玩家', clone(data), lodash, false, false, {})),
  ['玩家庄园', '共管基地', '敌军据点', '无主遗迹'],
  '世界推进关闭时，正文必须读取整个顶层资产账簿',
);

console.log('prose asset visibility tests passed');
