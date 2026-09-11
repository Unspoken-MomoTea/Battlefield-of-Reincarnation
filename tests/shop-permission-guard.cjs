const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const match = source.match(/\/\/ SHOP_PERMISSION_GUARD_START([\s\S]*?)\/\/ SHOP_PERMISSION_GUARD_END/);
assert(match, 'permission guard block must exist');

const sandbox = {};
vm.runInNewContext(`${match[0]}\nthis.guard = { shopPermissionCapRank, shopPermissionDecision };`, sandbox);
const { shopPermissionCapRank, shopPermissionDecision } = sandbox.guard;
const grade = rank => ['F','E','D','C','B','A','S','SS','SSS'][rank];

// Reported regression: III-tier character + E credential must NOT unlock SSS.
const reported = { 层级: 'Ⅲ', 道具: { 'E级权限凭证': { 数量: 1 } }, 状态: {} };
assert.equal(grade(shopPermissionCapRank(reported)), 'C');
assert.equal(shopPermissionDecision(reported, { name: 'SSS升级', rating: 'SSS' }).allowed, false);
assert.equal(shopPermissionDecision(reported, { name: 'C升级', rating: 'C' }).allowed, true);

// A credential only raises the cap when it is higher than the natural tier+1 view.
const withS = { 层级: 'Ⅲ', 道具: { 'S级权限凭证': { 数量: 1 } } };
assert.equal(grade(shopPermissionCapRank(withS)), 'S');
assert.equal(shopPermissionDecision(withS, { rating: 'S' }).allowed, true);
assert.equal(shopPermissionDecision(withS, { rating: 'SS' }).allowed, false);

// Zero-count credentials cannot grant access.
const emptyCredential = { 层级: 'Ⅲ', 道具: { 'SSS级权限凭证': { 数量: 0 } } };
assert.equal(grade(shopPermissionCapRank(emptyCredential)), 'C');

// Roman form tiers use the same F→SSS ladder.
assert.equal(shopPermissionDecision(reported, { tier: 'Ⅳ' }).allowed, true);
assert.equal(shopPermissionDecision(reported, { tier: 'Ⅸ' }).allowed, false);

// Top-tier characters naturally cap at SSS without overflow.
const topTier = { 层级: 'Ⅸ', 道具: {} };
assert.equal(grade(shopPermissionCapRank(topTier)), 'SSS');
assert.equal(shopPermissionDecision(topTier, { rating: 'SSS' }).allowed, true);

// Defense-in-depth seams: locked UI + authoritative pre-deduction transaction guard + prompt section alignment.
assert(source.includes("var permissionLocked = (!isSelected && !permission.allowed);"));
assert(source.includes("if (!gate.allowed) throw new Error(shopPermissionMessage(gate, gateItem));"));
assert(source.includes("if (reason === 'permission')"));
assert(source.includes('【当前购买对象数据】中的道具/状态'));
assert(!source.includes('商品一旦生成即可直接购买'));

console.log('shop permission guard regression passed');
