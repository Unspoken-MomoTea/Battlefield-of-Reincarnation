const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const statusbar = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const zodSource = fs.readFileSync(path.join(root, 'script', 'ZOD脚本.js'), 'utf8');

function part(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing source slice: ${start}`);
  return text.slice(a, b);
}

// seam 1：状态栏对玩家资产的可见归属必须使用当前 Tavern Persona 名，旧占位符只做兼容。
assert.match(statusbar, /var PLAYER_NAME = '';/, '状态栏应维护一份共享的当前玩家名');
assert.match(statusbar, /function refreshPlayerName\(\)/, '状态栏应通过统一入口刷新当前玩家名');
const statusAssetBlock = part(statusbar, '    function normalizeAssetOwnersUi(value) {', '    // 资产类型 → 图标');
const host = { SillyTavern: { getContext: () => ({ name1: '测试玩家' }), name1: '后备玩家' } };
const getPlayerName = () => String(host.SillyTavern.getContext().name1 || host.SillyTavern.name1 || '').trim();
const isPlayerIdentity = value => {
  const text = String(value ?? '').trim();
  const name = getPlayerName();
  return (!!name && text === name) || text === '<user>' || text === '{{user}}' || text === '玩家';
};
const canonicalPlayerIdentity = value => {
  const text = String(value ?? '').trim();
  return isPlayerIdentity(text) ? (getPlayerName() || text) : text;
};
const displayPlayerIdentity = value => isPlayerIdentity(value) ? (getPlayerName() || '玩家') : String(value ?? '').trim();
const statusFns = new Function(
  'safeStr', 'esc', 'getPlayerName', 'isPlayerIdentity', 'canonicalPlayerIdentity', 'displayPlayerIdentity',
  statusAssetBlock + '; return { normalizeAssetOwnersUi, assetOwnerChips };'
)(v => String(v ?? ''), String, getPlayerName, isPlayerIdentity, canonicalPlayerIdentity, displayPlayerIdentity);
assert.deepEqual(statusFns.normalizeAssetOwnersUi(undefined), ['测试玩家']);
assert.deepEqual(statusFns.normalizeAssetOwnersUi(['<user>', '{{user}}', '玩家', '测试玩家', '盟友']), ['测试玩家', '盟友']);
const ownerChip = statusFns.assetOwnerChips(['测试玩家']);
assert.match(ownerChip, /player/);
assert.match(ownerChip, /测试玩家/);
assert.doesNotMatch(ownerChip, /<user>/);

// seam 2：MVU Schema 的资产归属归一化必须把旧占位符收敛为 Persona 实际名称。
const zodOwnerBlock = part(zodSource, 'const normalizeAssetOwners = v => {', 'const assetOwners =');
const normalizeAssetOwners = new Function(
  'getPlayerName', 'LEGACY_PLAYER_OWNER_NAMES',
  zodOwnerBlock + '; return normalizeAssetOwners;'
)(() => '测试玩家', new Set(['<user>', '{{user}}', '玩家']));
assert.deepEqual(normalizeAssetOwners(undefined), ['测试玩家']);
assert.deepEqual(normalizeAssetOwners(['<user>', '{{user}}', '玩家', '测试玩家', '盟友']), ['测试玩家', '盟友']);
assert.deepEqual(normalizeAssetOwners([]), [], '显式空数组仍表示无主');

// seam 3：世界推进请求读取完整资产账簿，并把旧玩家占位符只在请求投影中解析为当前 Persona 名。
const previousSillyTavern = global.SillyTavern;
global.SillyTavern = { getContext: () => ({ name1: '测试玩家' }), name1: '后备玩家' };
delete require.cache[require.resolve('../script/世界推进系统.js')];
const { projectWorldContext, emptyState } = require('../script/世界推进系统.js');
const stat = emptyState();
stat.资产 = {
  玩家旧宅: { 所属对象: ['<user>'], 类型: '固定地产', 主体规模: 1, 完整度: 100, 状态: '正常', 能源: null, 消耗单元: {}, 建设序列: {}, 驻扎人员: {}, 待办事件: [] },
  共管仓库: { 所属对象: ['盟友', '{{user}}'], 类型: '固定地产', 主体规模: 1, 完整度: 100, 状态: '正常', 能源: null, 消耗单元: {}, 建设序列: {}, 驻扎人员: {}, 待办事件: [] },
  敌军要塞: { 所属对象: ['敌军'], 类型: '要塞', 主体规模: 5, 完整度: 100, 状态: '正常', 能源: null, 消耗单元: {}, 建设序列: {}, 驻扎人员: {}, 待办事件: [] },
};
const ctx = projectWorldContext(stat);
assert.deepEqual(ctx.玩家身份, { 名称: '测试玩家' });
assert.deepEqual(ctx.资产.玩家旧宅.所属对象, ['测试玩家']);
assert.deepEqual(ctx.资产.共管仓库.所属对象, ['盟友', '测试玩家']);
assert.deepEqual(ctx.资产.敌军要塞.所属对象, ['敌军']);

global.SillyTavern = previousSillyTavern;
console.log('PASS canonical player identity uses Tavern Persona name across statusbar, MVU assets and world-engine request projection');
